package main

import (
	"database/sql"
	"net/http"
	"os"

	"io"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerDownloadFile(w http.ResponseWriter, r *http.Request) {
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

	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "File not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving file info", err)
		return
	}

	// Check access via file_access_keys
	accessKey, err := cfg.dbQueries.GetFileAccessKey(r.Context(), database.GetFileAccessKeyParams{
		FileID: uuid.NullUUID{UUID: fileID, Valid: true},
		UserID: uuid.NullUUID{UUID: userID, Valid: true},
	})

	hasAccess := false
	wrappedKey := ""

	if err == nil {
		hasAccess = true
		wrappedKey = accessKey.WrappedKey
	} else if err == sql.ErrNoRows {
		// Fallback: Check if owner (for legacy files or if key is missing)
		if dbFile.OwnerID.Valid && dbFile.OwnerID.UUID == userID {
			hasAccess = true
		}
	} else {
		respondWithError(w, http.StatusInternalServerError, "Error checking file access", err)
		return
	}

	if !hasAccess {
		respondWithError(w, http.StatusForbidden, "You do not have access to this file", nil)
		return
	}

	// Debug logging
	if dbFile.EncryptedMetadata.Valid {
		println("Metadata found:", dbFile.EncryptedMetadata.String)
	} else {
		println("No metadata found for file:", dbFile.ID.String())
	}

	// Open the file from disk
	file, err := os.Open(dbFile.FilePath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not read file from disk", err)
		return
	}
	defer file.Close()

	// Set headers
	w.Header().Set("Content-Disposition", "attachment; filename=\""+dbFile.Filename+"\"")
	w.Header().Set("Content-Type", "application/octet-stream")

	// Return metadata in a custom header so the client can decrypt
	if dbFile.EncryptedMetadata.Valid {
		w.Header().Set("X-File-Metadata", dbFile.EncryptedMetadata.String)
	}

	// Return wrapped key if available
	if wrappedKey != "" {
		w.Header().Set("X-Wrapped-Key", wrappedKey)
	}

	// Stream the file content
	_, err = io.Copy(w, file)
	if err != nil {
		// Can't send JSON error here because we might have already sent some bytes
		// Just log it if we had a logger, or ignore
		return
	}
}
