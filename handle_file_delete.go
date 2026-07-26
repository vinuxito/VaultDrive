package main

import (
	"net/http"
	"os"

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

	// Delete only from the configured storage root.
	storagePath, pathErr := resolveStoredFilePath(dbFile.FilePath)
	if pathErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Stored file path is invalid", pathErr)
		return
	}
	err = os.Remove(storagePath)
	if err != nil && !os.IsNotExist(err) {
		respondWithError(w, http.StatusInternalServerError, "Could not delete file from disk", err)
		return
	}

	// Delete from database
	err = cfg.dbQueries.DeleteFile(r.Context(), fileID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not delete file from database", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "File deleted successfully",
		"file_id": fileID,
	})
}
