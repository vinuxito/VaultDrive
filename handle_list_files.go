package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/vinuxito/VaultDrive/auth"
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
		DropFolderID   *string   `json:"drop_folder_id"`
		DropFolderName *string   `json:"drop_folder_name"`
		PinWrappedKey  *string   `json:"pin_wrapped_key"`
		FolderID       *string   `json:"folder_id"`
	}

	// Optional filename search — case-insensitive substring match.
	searchQuery := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	fileResponses := []FileResponse{}
	for _, f := range files {
		if searchQuery != "" && !strings.Contains(strings.ToLower(f.Filename), searchQuery) {
			continue
		}
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

		var dropFolderID *string = nil
		if f.DropFolderID.Valid {
			id := f.DropFolderID.UUID.String()
			dropFolderID = &id
		}

		var pinWrappedKey *string = nil
		if f.PinWrappedKey.Valid && f.PinWrappedKey.String != "" {
			pinWrappedKey = &f.PinWrappedKey.String
		}

		var folderID *string = nil
		if f.FolderID.Valid {
			id := f.FolderID.UUID.String()
			folderID = &id
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
			DropFolderID:   dropFolderID,
			DropFolderName: dropFolderName,
			PinWrappedKey:  pinWrappedKey,
			FolderID:       folderID,
		})
	}

	respondWithJSON(w, http.StatusOK, fileResponses)
}
