package main

import (
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerListFiles(w http.ResponseWriter, r *http.Request) {
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

	files, err := cfg.dbQueries.GetFilesWithDropSource(r.Context(), uuid.NullUUID{UUID: userID, Valid: true})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not retrieve files", err)
		return
	}

	type FileResponse struct {
		ID             uuid.UUID `json:"id"`
		Filename       string    `json:"filename"`
		FileSize       int64     `json:"file_size"`
		CreatedAt      time.Time `json:"created_at"`
		Metadata       string    `json:"metadata"`
		IsOwner        bool      `json:"is_owner"`
		Starred        bool      `json:"starred"`
		OwnerEmail     *string   `json:"owner_email"`
		OwnerName      *string   `json:"owner_name"`
		GroupName      *string   `json:"group_name"`
		GroupID        *string   `json:"group_id"`
		SharedBy       *string   `json:"shared_by"`
		SharedByEmail  *string   `json:"shared_by_email"`
		SharedByName   *string   `json:"shared_by_name"`
		SharedAt       *string   `json:"shared_at"`
		DropToken      *string   `json:"drop_token"`
		DropFolderName *string   `json:"drop_folder_name"`
		DropWrappedKey *string   `json:"drop_wrapped_key"`
	}

	fileResponses := []FileResponse{}
	for _, f := range files {
		meta := ""
		if f.EncryptedMetadata.Valid {
			meta = f.EncryptedMetadata.String
		}

		var dropToken *string = nil
		if f.DropToken.Valid && f.DropToken.String != "" {
			dropToken = &f.DropToken.String
		}

		var dropFolderName *string = nil
		if f.DropFolderName.Valid && f.DropFolderName.String != "" {
			dropFolderName = &f.DropFolderName.String
		}

		var dropWrappedKey *string = nil
		if f.DropWrappedKey.Valid && f.DropWrappedKey.String != "" {
			dropWrappedKey = &f.DropWrappedKey.String
		}

		fileResponses = append(fileResponses, FileResponse{
			ID:             f.ID,
			Filename:       f.Filename,
			FileSize:       f.FileSize,
			CreatedAt:      f.CreatedAt,
			Metadata:       meta,
			IsOwner:        true,
			Starred:        f.Starred,
			DropToken:      dropToken,
			DropFolderName: dropFolderName,
			DropWrappedKey: dropWrappedKey,
		})
	}

	respondWithJSON(w, http.StatusOK, fileResponses)
}
