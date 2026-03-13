package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Group name is required", nil)
		return
	}

	group, err := cfg.dbQueries.CreateGroup(context.Background(), database.CreateGroupParams{
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
	_, err = cfg.dbQueries.AddGroupMember(context.Background(), database.AddGroupMemberParams{
		GroupID: group.ID,
		UserID:  user.ID,
		Role:    databaseToNullString("owner"),
	})
	if err != nil {
		// Log error but don't fail the request - group was created successfully
		log.Printf("Warning: Failed to add owner as member of group %s: %v", group.ID, err)
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

	group, err := cfg.dbQueries.GetGroupByID(context.Background(), id)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Group not found", err)
		return
	}

	// Check if user is member or owner
	_, err = cfg.dbQueries.IsUserInGroup(context.Background(), database.IsUserInGroupParams{
		GroupID: id,
		UserID:  user.ID,
	})
	if err != nil && group.UserID != user.ID {
		respondWithError(w, http.StatusForbidden, "You are not a member of this group", nil)
		return
	}

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

	err = cfg.dbQueries.DeleteGroup(context.Background(), database.DeleteGroupParams{
		ID:     id,
		UserID: user.ID,
	})
	if err != nil {
		log.Printf("Error deleting group: %v", err)
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
