package main

import (
	"database/sql"
	"net/http"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerRevokeFileAccess(w http.ResponseWriter, r *http.Request) {
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

	targetUserIDStr := r.PathValue("user_id")
	if targetUserIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "Target User ID is required", nil)
		return
	}

	targetUserID, err := uuid.Parse(targetUserIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid Target User ID format", err)
		return
	}

	// Verify file ownership
	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "File not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving file info", err)
		return
	}

	if !dbFile.OwnerID.Valid || dbFile.OwnerID.UUID != userID {
		respondWithError(w, http.StatusForbidden, "You do not have permission to revoke access for this file", nil)
		return
	}

	err = cfg.dbQueries.DeleteFileAccessKey(r.Context(), database.DeleteFileAccessKeyParams{
		FileID: uuid.NullUUID{UUID: fileID, Valid: true},
		UserID: uuid.NullUUID{UUID: targetUserID, Valid: true},
	})

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not revoke access", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "Access revoked successfully",
	})
}
