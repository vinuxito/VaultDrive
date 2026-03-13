package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

type updateGroupRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// PUT /abrn/api/groups/{id} - Update group
func (cfg *ApiConfig) updateGroupHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	groupIDStr := r.PathValue("id")
	groupID, err := uuid.Parse(groupIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	var req updateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	group, err := cfg.dbQueries.GetGroupByID(context.Background(), groupID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Group not found", err)
		return
	}

	_, err = cfg.dbQueries.UpdateGroup(context.Background(), database.UpdateGroupParams{
		ID:          groupID,
		UserID:      user.ID,
		Name:        sql.NullString{String: req.Name, Valid: req.Name != ""},
		Description: sql.NullString{String: req.Description, Valid: req.Description != ""},
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update group", err)
		return
	}

	respondWithJSON(w, http.StatusOK, group)
}
