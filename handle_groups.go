package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

const (
	maxGroupRequestBytes = 64 << 10
	maxGroupNameBytes    = 255
	maxGroupDescription  = 4096
	maxGroupWrappedKey   = 16 << 10
)

var errGroupForbidden = errors.New("group access forbidden")

type groupAuthorization struct {
	group  database.GetGroupByIDRow
	owner  bool
	member bool
}

func decodeGroupRequest(w http.ResponseWriter, r *http.Request, dst interface{}) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxGroupRequestBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return errors.New("request must contain one JSON object")
		}
		return err
	}
	return nil
}

func groupAuthorizationFor(ctx context.Context, queries *database.Queries, groupID, userID uuid.UUID) (groupAuthorization, error) {
	group, err := queries.GetGroupByID(ctx, groupID)
	if err != nil {
		return groupAuthorization{}, err
	}
	if group.UserID == userID {
		return groupAuthorization{group: group, owner: true, member: true}, nil
	}
	if _, err := queries.IsUserInGroup(ctx, database.IsUserInGroupParams{GroupID: groupID, UserID: userID}); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return groupAuthorization{group: group}, errGroupForbidden
		}
		return groupAuthorization{}, err
	}
	return groupAuthorization{group: group, member: true}, nil
}

func respondGroupAuthorizationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sql.ErrNoRows):
		respondWithError(w, http.StatusNotFound, "Group not found", nil)
	case errors.Is(err, errGroupForbidden):
		respondWithError(w, http.StatusForbidden, "You do not have access to this group", nil)
	default:
		respondWithError(w, http.StatusInternalServerError, "Could not verify group access", err)
	}
}

func recordGroupMutation(ctx context.Context, queries *database.Queries, r *http.Request, actorID uuid.UUID, action, eventType, resourceType string, resourceID uuid.UUID, metadata map[string]string) error {
	payload := make(map[string]string, len(metadata)+2)
	for key, value := range metadata {
		payload[key] = value
	}
	payload["action"] = action
	payload["resource_id"] = resourceID.String()
	if err := queries.InsertActivity(ctx, database.InsertActivityParams{
		UserID: actorID, EventType: eventType, Payload: marshalJSONB(payload),
	}); err != nil {
		return err
	}
	_, err := queries.CreateAuditLog(ctx, database.CreateAuditLogParams{
		UserID: nullUUID(actorID), Action: action, ResourceType: resourceType,
		ResourceID: nullUUID(resourceID), Metadata: marshalJSONB(metadata),
		IpAddress: requestInet(r), CreatedAt: time.Now().UTC(),
	})
	return err
}

func (cfg *ApiConfig) getGroupsHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	groups, err := cfg.dbQueries.GetGroupsForUser(context.Background(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error fetching groups", err)
		return
	}

	// Transform to frontend-friendly format
	response := make([]map[string]interface{}, len(groups))
	for i, g := range groups {
		response[i] = map[string]interface{}{
			"id":           g.ID,
			"user_id":      g.UserID,
			"name":         g.Name,
			"description":  nullStringToString(g.Description),
			"role":         nullStringToString(g.Role),
			"member_count": g.MemberCount,
			"file_count":   g.FileCount,
			"created_at":   g.CreatedAt,
			"updated_at":   g.UpdatedAt,
		}
	}

	respondWithJSON(w, http.StatusOK, response)
}

func (cfg *ApiConfig) createGroupHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	type GroupRequest struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	var req GroupRequest
	if err := decodeGroupRequest(w, r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Group name is required", nil)
		return
	}
	if len(req.Name) > maxGroupNameBytes || len(req.Description) > maxGroupDescription {
		respondWithError(w, http.StatusBadRequest, "Group name or description is too long", nil)
		return
	}

	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error creating group", err)
		return
	}
	defer tx.Rollback()
	queries := cfg.dbQueries.WithTx(tx)
	group, err := queries.CreateGroup(r.Context(), database.CreateGroupParams{
		UserID:      user.ID,
		Name:        req.Name,
		Description: databaseToNullString(req.Description),
	})
	if err != nil {
		// Check if duplicate group name for this user
		if strings.Contains(err.Error(), "duplicate key") && strings.Contains(err.Error(), "uq_user_group_name") {
			respondWithError(w, http.StatusConflict, "A group with this name already exists", nil)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error creating group", err)
		return
	}

	// Automatically add the owner as a member with "owner" role
	_, err = queries.AddGroupMember(r.Context(), database.AddGroupMemberParams{
		GroupID: group.ID,
		UserID:  user.ID,
		Role:    databaseToNullString("owner"),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error creating group owner membership", err)
		return
	}
	if err := recordGroupMutation(r.Context(), queries, r, user.ID, "group.created", "group_created", "group", group.ID, map[string]string{"name": group.Name}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error recording group creation", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error committing group creation", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"id":          group.ID,
		"name":        group.Name,
		"description": nullStringToString(group.Description),
		"user_id":     group.UserID,
		"created_at":  group.CreatedAt,
		"updated_at":  group.UpdatedAt,
	})
}

func (cfg *ApiConfig) getGroupHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	authz, err := groupAuthorizationFor(r.Context(), cfg.dbQueries, id, user.ID)
	if err != nil {
		respondGroupAuthorizationError(w, err)
		return
	}
	group := authz.group

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"id":           group.ID,
		"user_id":      group.UserID,
		"name":         group.Name,
		"description":  nullStringToString(group.Description),
		"member_count": group.MemberCount,
		"file_count":   group.FileCount,
		"created_at":   group.CreatedAt,
		"updated_at":   group.UpdatedAt,
	})
}

func (cfg *ApiConfig) deleteGroupHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	authz, err := groupAuthorizationFor(r.Context(), cfg.dbQueries, id, user.ID)
	if err != nil {
		respondGroupAuthorizationError(w, err)
		return
	}
	if !authz.owner {
		respondWithError(w, http.StatusForbidden, "Only the group owner can delete this group", nil)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error deleting group", err)
		return
	}
	defer tx.Rollback()
	queries := cfg.dbQueries.WithTx(tx)
	var deleted uuid.UUID
	if err := tx.QueryRowContext(r.Context(), `DELETE FROM groups WHERE id=$1 AND user_id=$2 RETURNING id`, id, user.ID).Scan(&deleted); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "Group not found", nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "Error deleting group", err)
		}
		return
	}
	if err := recordGroupMutation(r.Context(), queries, r, user.ID, "group.deleted", "group_deleted", "group", id, map[string]string{"group_name": authz.group.Name}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error recording group deletion", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error committing group deletion", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Group deleted"})
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

func databaseToNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}

func nullStringToString(ns sql.NullString) string {
	if !ns.Valid {
		return ""
	}
	return ns.String
}
