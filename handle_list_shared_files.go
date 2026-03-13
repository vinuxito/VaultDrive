package main

import (
	"database/sql"
	"net/http"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerListSharedFiles(w http.ResponseWriter, r *http.Request) {
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

	// Get all files shared with this user
	fileAccessKeys, err := cfg.dbQueries.GetFileAccessKeysByUser(r.Context(), uuid.NullUUID{UUID: userID, Valid: true})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not retrieve shared files", err)
		return
	}

	// For each access key, get the file details
	type SharedFileResponse struct {
		ID                string `json:"id"`
		Filename          string `json:"filename"`
		FileSize          int64  `json:"file_size"`
		OwnerUsername     string `json:"owner_username"`
		SharedAt          string `json:"shared_at"`
		EncryptedMetadata string `json:"encrypted_metadata"`
	}

	sharedFiles := []SharedFileResponse{}

	for _, accessKey := range fileAccessKeys {
		if !accessKey.FileID.Valid {
			continue
		}

		// Get file details
		file, err := cfg.dbQueries.GetFileByID(r.Context(), accessKey.FileID.UUID)
		if err != nil {
			// Skip files that can't be found
			continue
		}

		// Get owner details
		var ownerUsername string
		if file.OwnerID.Valid {
			owner, err := cfg.dbQueries.GetUserByID(r.Context(), file.OwnerID.UUID)
			if err == nil {
				ownerUsername = owner.Username
			}
		}

		sharedAt := ""
		if accessKey.CreatedAt.Valid {
			sharedAt = accessKey.CreatedAt.Time.Format("2006-01-02T15:04:05Z")
		}

		metadata := ""
		if file.EncryptedMetadata.Valid {
			metadata = file.EncryptedMetadata.String
		}

		sharedFiles = append(sharedFiles, SharedFileResponse{
			ID:                file.ID.String(),
			Filename:          file.Filename,
			FileSize:          file.FileSize,
			OwnerUsername:     ownerUsername,
			SharedAt:          sharedAt,
			EncryptedMetadata: metadata,
		})
	}

	respondWithJSON(w, http.StatusOK, sharedFiles)
}

// handlerListFileShares returns the list of users a file has been shared with
func (cfg *ApiConfig) handlerListFileShares(w http.ResponseWriter, r *http.Request) {
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
		respondWithError(w, http.StatusForbidden, "You do not have permission to view shares for this file", nil)
		return
	}

	// Get all access keys (shares) for this file
	accessKeys, err := cfg.dbQueries.GetFileAccessKeysByFile(r.Context(), uuid.NullUUID{UUID: fileID, Valid: true})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not retrieve shares", err)
		return
	}

	// Build response with user details
	type SharedWithUser struct {
		UserID   string `json:"user_id"`
		Username string `json:"username"`
		Email    string `json:"email"`
		SharedAt string `json:"shared_at"`
	}

	sharedWithUsers := []SharedWithUser{}

	for _, accessKey := range accessKeys {
		if !accessKey.UserID.Valid {
			continue
		}

		// Get user details
		user, err := cfg.dbQueries.GetUserByID(r.Context(), accessKey.UserID.UUID)
		if err != nil {
			// Skip users that can't be found
			continue
		}

		sharedAt := ""
		if accessKey.CreatedAt.Valid {
			sharedAt = accessKey.CreatedAt.Time.Format("2006-01-02T15:04:05Z")
		}

		sharedWithUsers = append(sharedWithUsers, SharedWithUser{
			UserID:   user.ID.String(),
			Username: user.Username,
			Email:    user.Email,
			SharedAt: sharedAt,
		})
	}

	respondWithJSON(w, http.StatusOK, sharedWithUsers)
}
