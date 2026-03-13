package main

import (
	"context"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

// POST /abrn/api/files/{id}/star - Toggle file starred status
func (cfg *ApiConfig) handlerToggleFileStar(w http.ResponseWriter, r *http.Request) {
	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Missing or invalid token", err)
		return
	}

	userID, err := auth.ValidateJWT(token, cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
		return
	}

	fileIDStr := r.PathValue("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	// Verify file ownership
	file, err := cfg.dbQueries.GetFileByID(context.Background(), fileID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File not found", err)
		return
	}

	if file.OwnerID.UUID != userID {
		respondWithError(w, http.StatusForbidden, "You don't have permission to star this file", nil)
		return
	}

	// Toggle starred status
	updatedFile, err := cfg.dbQueries.ToggleFileStarred(context.Background(), database.ToggleFileStarredParams{
		ID:        fileID,
		Starred:   !file.Starred,
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to toggle star status", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"id":       updatedFile.ID,
		"filename": updatedFile.Filename,
		"stared":   updatedFile.Starred,
	})
}
