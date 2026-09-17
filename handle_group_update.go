package main

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type updateGroupRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// PUT /api/groups/{id} - Update group
func (cfg *ApiConfig) updateGroupHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	groupIDStr := r.PathValue("id")
	groupID, err := uuid.Parse(groupIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	var req updateGroupRequest
	if err := decodeGroupRequest(w, r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if len(req.Name) > maxGroupNameBytes || len(req.Description) > maxGroupDescription {
		respondWithError(w, http.StatusBadRequest, "Group name or description is too long", nil)
		return
	}
	if req.Name == "" && req.Description == "" {
		respondWithError(w, http.StatusBadRequest, "A group name or description is required", nil)
		return
	}

	authz, err := groupAuthorizationFor(r.Context(), cfg.dbQueries, groupID, user.ID)
	if err != nil {
		respondGroupAuthorizationError(w, err)
		return
	}
	if !authz.owner {
		respondWithError(w, http.StatusForbidden, "Only the group owner can update this group", nil)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update group", err)
		return
	}
	defer tx.Rollback()
	queries := cfg.dbQueries.WithTx(tx)

	group, err := queries.UpdateGroup(r.Context(), database.UpdateGroupParams{
		ID:          groupID,
		UserID:      user.ID,
		Name:        sql.NullString{String: req.Name, Valid: req.Name != ""},
		Description: sql.NullString{String: req.Description, Valid: req.Description != ""},
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update group", err)
		return
	}
	if err := recordGroupMutation(r.Context(), queries, r, user.ID, "group.updated", "group_updated", "group", groupID, map[string]string{"name": group.Name}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to record group update", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to commit group update", err)
		return
	}

	respondWithJSON(w, http.StatusOK, group)
}
