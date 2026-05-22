package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func (cfg *ApiConfig) handlerCreateFiles(w http.ResponseWriter, r *http.Request) {

	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Missing or invalid token", err)
		return
	}

	ownerID, err := auth.ValidateJWT(token, cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
		return
	}

	// Parse multipart form (max 10 MB)
	err = r.ParseMultipartForm(10 << 20)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Could not parse multipart form", err)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Error retrieving the file", err)
		return
	}
	defer file.Close()

	// Create uploads directory if it doesn't exist
	uploadDir := uploadStorageDir()
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		err = os.Mkdir(uploadDir, 0755)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Could not create uploads directory", err)
			return
		}
	}

	// Generate a unique filename to prevent overwriting
	filename := uuid.New().String() + filepath.Ext(handler.Filename)
	filePath := filepath.Join(uploadDir, filename)

	// Create the file on the server
	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("ERROR: Could not create file on server %s: %v", filePath, err)
		respondWithError(w, http.StatusInternalServerError, "Could not create file on server", err)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the destination file
	if _, err := io.Copy(dst, file); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not save file", err)
		return
	}

	// Extract encryption metadata
	credentialScheme := r.FormValue("credential_scheme")
	if credentialScheme == "" {
		credentialScheme = "password"
	}
	metadata := map[string]string{
		"iv":                r.FormValue("iv"),
		"salt":              r.FormValue("salt"),
		"algorithm":         r.FormValue("algorithm"),
		"credential_scheme": credentialScheme,
	}

	wrappedKey := r.FormValue("wrapped_key")
	if wrappedKey == "" {
		os.Remove(filePath)
		respondWithError(w, http.StatusBadRequest, "wrapped_key is required", nil)
		return
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		os.Remove(filePath)
		respondWithError(w, http.StatusInternalServerError, "Error processing metadata", err)
		return
	}

	// Optional folder assignment
	var folderUUID uuid.NullUUID
	if folderIDStr := r.FormValue("folder_id"); folderIDStr != "" {
		fid, parseErr := uuid.Parse(folderIDStr)
		if parseErr == nil {
			folderUUID = uuid.NullUUID{UUID: fid, Valid: true}
		}
	}

	dbfile, err := cfg.dbQueries.CreateFile(r.Context(), database.CreateFileParams{
		OwnerID:           uuid.NullUUID{UUID: ownerID, Valid: true},
		Filename:          handler.Filename,
		FilePath:          filePath,
		FileSize:          handler.Size,
		EncryptedMetadata: sql.NullString{String: string(metadataJSON), Valid: true},
		CurrentKeyVersion: sql.NullInt32{Int32: 1, Valid: true},
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
		DropSourceID:      uuid.NullUUID{},
		FolderID:          folderUUID,
	})

	if err != nil {
		// If DB insert fails, we should probably delete the uploaded file
		os.Remove(filePath)
		log.Printf("ERROR: Could not create file entry in DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Could not create file entry", err)
		return
	}

	// Save the wrapped key for the owner
	_, err = cfg.dbQueries.CreateFileAccessKey(r.Context(), database.CreateFileAccessKeyParams{
		FileID:     uuid.NullUUID{UUID: dbfile.ID, Valid: true},
		UserID:     uuid.NullUUID{UUID: ownerID, Valid: true},
		WrappedKey: wrappedKey,
	})

	if err != nil {
		// Rollback: delete file and DB entry
		os.Remove(filePath)
		cfg.dbQueries.DeleteFile(r.Context(), dbfile.ID)
		log.Printf("ERROR: Could not save file access key: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Could not save file access key", err)
		return
	}
	cfg.insertActivity(r.Context(), ownerID, "file_upload", map[string]interface{}{
		"file_id":   dbfile.ID.String(),
		"filename":  dbfile.Filename,
		"file_size": dbfile.FileSize,
	})
	cfg.insertAudit(r.Context(), ownerID, "file.uploaded", "file", &dbfile.ID, map[string]interface{}{
		"filename":  dbfile.Filename,
		"file_size": dbfile.FileSize,
	}, r)

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"file_name":  dbfile.Filename,
		"file_path":  dbfile.FilePath,
		"file_id":    dbfile.ID,
		"owner_id":   dbfile.OwnerID,
		"created_at": dbfile.CreatedAt,
		"updated_at": dbfile.UpdatedAt,
		"metadata":   dbfile.EncryptedMetadata.String,
	})

}

func (cfg *ApiConfig) handlerMoveFileToFolder(w http.ResponseWriter, r *http.Request, user database.User) {
	fileIDStr := r.PathValue("id")
	if fileIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "File ID is required", nil)
		return
	}

	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID format", err)
		return
	}

	var body struct {
		FolderID string `json:"folder_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}
	if body.FolderID == "" {
		respondWithError(w, http.StatusBadRequest, "folder_id is required", nil)
		return
	}

	targetFolderID, err := uuid.Parse(body.FolderID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID format", err)
		return
	}

	file, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithErrorCtx(r, w, http.StatusNotFound, "ErrFileNotFound", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving file", err)
		return
	}
	if !file.OwnerID.Valid || file.OwnerID.UUID != user.ID {
		respondWithError(w, http.StatusForbidden, "You do not own this file", nil)
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), targetFolderID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Target folder not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving target folder", err)
		return
	}
	if folder.OwnerID != user.ID {
		respondWithError(w, http.StatusForbidden, "You do not own the target folder", nil)
		return
	}

	if file.FolderID.Valid && file.FolderID.UUID == targetFolderID {
		respondWithJSON(w, http.StatusOK, map[string]any{
			"status":    "success",
			"moved":     false,
			"file_id":   file.ID,
			"folder_id": targetFolderID,
		})
		return
	}

	err = cfg.dbQueries.UpdateFileFolderID(r.Context(), database.UpdateFileFolderIDParams{
		FolderID:  uuid.NullUUID{UUID: targetFolderID, Valid: true},
		UpdatedAt: time.Now().UTC(),
		ID:        file.ID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to move file", err)
		return
	}

	cfg.insertActivity(r.Context(), user.ID, "file_moved", map[string]interface{}{
		"file_id":          file.ID.String(),
		"filename":         file.Filename,
		"target_folder":    folder.Name,
		"target_folder_id": targetFolderID.String(),
	})
	cfg.insertAudit(r.Context(), user.ID, "file.moved", "file", &file.ID, map[string]interface{}{
		"filename":         file.Filename,
		"target_folder_id": targetFolderID.String(),
		"target_folder":    folder.Name,
	}, r)

	respondWithJSON(w, http.StatusOK, map[string]any{
		"status":    "success",
		"moved":     true,
		"file_id":   file.ID,
		"folder_id": targetFolderID,
	})
}
