package main

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerShareFile(w http.ResponseWriter, r *http.Request) {
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

	type parameters struct {
		RecipientEmail string `json:"recipient_email"`
		WrappedKey     string `json:"wrapped_key"`
	}

	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	err = decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if params.RecipientEmail == "" || params.WrappedKey == "" {
		respondWithError(w, http.StatusBadRequest, "Recipient email and wrapped key are required", nil)
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
		respondWithError(w, http.StatusForbidden, "You do not have permission to share this file", nil)
		return
	}

	// Get recipient user
	recipient, err := cfg.dbQueries.GetUserByEmail(r.Context(), params.RecipientEmail)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Recipient user not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving recipient", err)
		return
	}

	// Insert access key for recipient
	_, err = cfg.dbQueries.CreateFileAccessKey(r.Context(), database.CreateFileAccessKeyParams{
		FileID:     uuid.NullUUID{UUID: fileID, Valid: true},
		UserID:     uuid.NullUUID{UUID: recipient.ID, Valid: true},
		WrappedKey: params.WrappedKey,
	})

	if err != nil {
		// Check if it's a unique constraint violation (already shared)
		// For now, just return generic error or we could check err string
		respondWithError(w, http.StatusInternalServerError, "Could not share file (already shared?)", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "File shared successfully",
	})
}
