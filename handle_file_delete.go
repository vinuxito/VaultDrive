package main

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
)

func (cfg *ApiConfig) handlerDeleteFile(w http.ResponseWriter, r *http.Request) {
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
	if fileIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "File ID is required", nil)
		return
	}

	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid File ID format", err)
		return
	}

	// Get file info to verify ownership and get file path
	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File not found", err)
		return
	}

	// Check ownership
	if !dbFile.OwnerID.Valid || dbFile.OwnerID.UUID != userID {
		respondWithError(w, http.StatusForbidden, "You do not have access to this file", nil)
		return
	}

	now := time.Now().UTC()
	if _, err := cfg.softDeleteFileWithActor(r.Context(), userID, fileID, "human_jwt", nil, "Eliminado desde Mi Bóveda (Papelera recuperable)", r); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not move file to Trash", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message":     "File moved to recoverable Trash",
		"file_id":     fileID,
		"recoverable": true,
		"deleted_at":  now,
	})
}
