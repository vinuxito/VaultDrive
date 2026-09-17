package main

import (
	"database/sql"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
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
		if dbFile.OwnerID.Valid && dbFile.OwnerID.UUID == userID {
			hasAccess = true
		} else {
			// Check if file is in a folder shared with the user
			if dbFile.FolderID.Valid {
				folder, folderErr := cfg.dbQueries.GetFolderByID(r.Context(), dbFile.FolderID.UUID)
				if folderErr == nil {
					hasFolderAccess := folder.OwnerID == userID
					if !hasFolderAccess {
						share, shareErr := cfg.dbQueries.GetFolderShare(r.Context(), database.GetFolderShareParams{
							FolderID: dbFile.FolderID.UUID,
							UserID:   userID,
						})
						if shareErr == nil && share.UserID == userID {
							hasFolderAccess = true
						}
					}
					if hasFolderAccess {
						hasAccess = true
						// Retrieve the folder-wrapped key
						folderKey, fkErr := cfg.dbQueries.GetFileAccessKey(r.Context(), database.GetFileAccessKeyParams{
							FileID: uuid.NullUUID{UUID: fileID, Valid: true},
							UserID: uuid.NullUUID{UUID: dbFile.FolderID.UUID, Valid: true},
						})
						if fkErr == nil {
							wrappedKey = folderKey.WrappedKey
						}
					}
				}
			}

			if !hasAccess {
				groupWrappedKey, groupErr := cfg.dbQueries.GetGroupWrappedKeyForUser(r.Context(), database.GetGroupWrappedKeyForUserParams{
					FileID: fileID,
					UserID: userID,
				})
				if groupErr == nil {
					hasAccess = true
					wrappedKey = groupWrappedKey
				} else if groupErr != sql.ErrNoRows {
					respondWithError(w, http.StatusInternalServerError, "Error checking group file access", groupErr)
					return
				}
			}
		}
	} else {
		respondWithError(w, http.StatusInternalServerError, "Error checking file access", err)
		return
	}

	if !hasAccess {
		respondWithError(w, http.StatusForbidden, "You do not have access to this file", nil)
		return
	}

	// Open the file from the configured storage root.
	storagePath, err := resolveStoredFilePath(dbFile.FilePath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Stored file path is invalid", err)
		return
	}
	file, err := os.Open(storagePath)
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

	actorType := "owner"
	if userID != dbFile.OwnerID.UUID {
		actorType = "user"
	}
	cfg.streamDownload(w, r, file, dbFile.OwnerID.UUID, dbFile.ID, map[string]interface{}{
		"actor_type": actorType, "actor_id": userID.String(),
		"filename": dbFile.Filename, "file_size": dbFile.FileSize,
	})
}
