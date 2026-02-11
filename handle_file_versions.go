package main

import (
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerGetFileVersions(w http.ResponseWriter, r *http.Request) {
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
	fileIDStr := r.PathValue("fileID")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	// Verify file ownership or access
	file, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File not found", err)
		return
	}

	if file.OwnerID.UUID != userID {
		respondWithError(w, http.StatusForbidden, "You don't have permission to view this file's versions", nil)
		return
	}

	// Get all versions for this file
	versions, err := cfg.dbQueries.GetFileVersions(r.Context(), fileID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch file versions", err)
		return
	}

	type versionResponse struct {
		ID            uuid.UUID `json:"id"`
		VersionNumber int32     `json:"version_number"`
		FileSize      int64     `json:"file_size"`
		CreatedAt     time.Time `json:"created_at"`
	}

	response := make([]versionResponse, len(versions))
	for i, version := range versions {
		response[i] = versionResponse{
			ID:            version.ID,
			VersionNumber: version.VersionNumber,
			FileSize:      version.FileSize,
			CreatedAt:     version.CreatedAt,
		}
	}

	respondWithJSON(w, http.StatusOK, response)
}

func (cfg *ApiConfig) handlerRestoreFileVersion(w http.ResponseWriter, r *http.Request) {
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
	fileIDStr := r.PathValue("fileID")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	versionIDStr := r.PathValue("versionID")
	versionID, err := uuid.Parse(versionIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid version ID", err)
		return
	}

	// Verify file ownership
	file, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File not found", err)
		return
	}

	if file.OwnerID.UUID != userID {
		respondWithError(w, http.StatusForbidden, "You don't have permission to restore this file", nil)
		return
	}

	// Get the version to restore
	version, err := cfg.dbQueries.GetFileVersionByID(r.Context(), versionID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Version not found", err)
		return
	}

	if version.FileID != fileID {
		respondWithError(w, http.StatusBadRequest, "Version does not belong to this file", nil)
		return
	}

	// Get the latest version number
	latestVersion, err := cfg.dbQueries.GetLatestVersion(r.Context(), fileID)
	var newVersionNumber int32
	if err != nil {
		// No versions exist yet, start at 1
		newVersionNumber = 1
	} else {
		newVersionNumber = latestVersion.VersionNumber + 1
	}

	// Create a new version entry with the restored content
	_, err = cfg.dbQueries.CreateFileVersion(r.Context(), database.CreateFileVersionParams{
		FileID:             fileID,
		VersionNumber:      newVersionNumber,
		FileSize:           version.FileSize,
		EncryptedPath:      version.EncryptedPath,
		EncryptionMetadata: version.EncryptionMetadata,
		CreatedBy: uuid.NullUUID{
			UUID:  userID,
			Valid: true,
		},
		CreatedAt: time.Now().UTC(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to restore version", err)
		return
	}

	// Update the file record
	updatedFile, err := cfg.dbQueries.UpdateFile(r.Context(), database.UpdateFileParams{
		ID:                file.ID,
		Filename:          file.Filename,
		FilePath:          version.EncryptedPath,
		FileSize:          version.FileSize,
		EncryptedMetadata: version.EncryptionMetadata,
		CurrentKeyVersion: file.CurrentKeyVersion,
		UpdatedAt:         time.Now().UTC(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update file", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"id":            updatedFile.ID,
		"filename":      updatedFile.Filename,
		"file_size":     updatedFile.FileSize,
		"restored_from": version.VersionNumber,
		"new_version":   newVersionNumber,
		"updated_at":    updatedFile.UpdatedAt,
	})
}
