package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerV1ListFiles(w http.ResponseWriter, r *http.Request, user database.User) {
	files, err := cfg.dbQueries.GetFilesWithDropSource(r.Context(), uuid.NullUUID{UUID: user.ID, Valid: true})
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not retrieve files")
		return
	}
	query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	items := make([]map[string]interface{}, 0, len(files))
	for _, file := range files {
		if query != "" && !strings.Contains(strings.ToLower(file.Filename), query) {
			continue
		}
		item := map[string]interface{}{
			"id":         file.ID.String(),
			"filename":   file.Filename,
			"file_size":  file.FileSize,
			"created_at": file.CreatedAt,
			"starred":    file.Starred,
			"is_owner":   true,
		}
		if file.EncryptedMetadata.Valid {
			item["metadata"] = file.EncryptedMetadata.String
		}
		if file.DropSourceID.Valid {
			item["origin"] = "secure_drop"
		} else {
			item["origin"] = "vault_upload"
		}
		items = append(items, item)
	}
	respondWithV1(w, r, http.StatusOK, items, map[string]int{"count": len(items)})
}

func (cfg *ApiConfig) handlerV1GetFileMetadata(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, ok := cfg.getOwnedFileForAccess(r, user)
	if !ok {
		respondWithV1Error(w, r, http.StatusForbidden, "You do not own this file")
		return
	}
	entry := map[string]interface{}{
		"id":         fileID.String(),
		"filename":   dbFile.Filename,
		"file_size":  dbFile.FileSize,
		"created_at": dbFile.CreatedAt,
		"updated_at": dbFile.UpdatedAt,
		"starred":    dbFile.Starred,
	}
	if dbFile.EncryptedMetadata.Valid {
		entry["metadata"] = dbFile.EncryptedMetadata.String
	}
	respondWithV1(w, r, http.StatusOK, entry, nil)
}

func (cfg *ApiConfig) handlerV1CreateFile(w http.ResponseWriter, r *http.Request, user database.User) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Could not parse multipart form")
		return
	}
	file, handler, err := r.FormFile("file")
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Encrypted file is required")
		return
	}
	defer file.Close()

	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not create uploads directory")
		return
	}
	filename := uuid.New().String() + filepath.Ext(handler.Filename)
	filePath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(filePath)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not create file on server")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not save file")
		return
	}

	wrappedKey := r.FormValue("wrapped_key")
	if wrappedKey == "" {
		_ = os.Remove(filePath)
		respondWithV1Error(w, r, http.StatusBadRequest, "wrapped_key is required")
		return
	}
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
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		_ = os.Remove(filePath)
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not encode metadata")
		return
	}
	dbFile, err := cfg.dbQueries.CreateFile(r.Context(), database.CreateFileParams{
		OwnerID:           uuid.NullUUID{UUID: user.ID, Valid: true},
		Filename:          handler.Filename,
		FilePath:          filePath,
		FileSize:          handler.Size,
		EncryptedMetadata: sql.NullString{String: string(metadataJSON), Valid: true},
		CurrentKeyVersion: sql.NullInt32{Int32: 1, Valid: true},
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
		DropSourceID:      uuid.NullUUID{},
	})
	if err != nil {
		_ = os.Remove(filePath)
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not create file entry")
		return
	}
	if _, err := cfg.dbQueries.CreateFileAccessKey(r.Context(), database.CreateFileAccessKeyParams{
		FileID:     uuid.NullUUID{UUID: dbFile.ID, Valid: true},
		UserID:     uuid.NullUUID{UUID: user.ID, Valid: true},
		WrappedKey: wrappedKey,
	}); err != nil {
		_ = os.Remove(filePath)
		_ = cfg.dbQueries.DeleteFile(r.Context(), dbFile.ID)
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not save file access key")
		return
	}
	cfg.insertActivity(r.Context(), user.ID, "file_upload", map[string]interface{}{
		"file_id":   dbFile.ID.String(),
		"filename":  dbFile.Filename,
		"file_size": dbFile.FileSize,
	})
	cfg.insertAudit(r.Context(), user.ID, "file.uploaded", "file", &dbFile.ID, map[string]interface{}{
		"filename":  dbFile.Filename,
		"file_size": dbFile.FileSize,
	}, r)
	respondWithV1(w, r, http.StatusCreated, map[string]interface{}{
		"id":         dbFile.ID.String(),
		"filename":   dbFile.Filename,
		"file_size":  dbFile.FileSize,
		"created_at": dbFile.CreatedAt,
	}, nil)
}

func (cfg *ApiConfig) handlerV1DownloadFile(w http.ResponseWriter, r *http.Request, user database.User) {
	fileIDStr := r.PathValue("id")
	if fileIDStr == "" {
		respondWithV1Error(w, r, http.StatusBadRequest, "File ID is required")
		return
	}
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid file ID")
		return
	}
	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		respondWithV1Error(w, r, http.StatusNotFound, "File not found")
		return
	}
	accessKey, err := cfg.dbQueries.GetFileAccessKey(r.Context(), database.GetFileAccessKeyParams{
		FileID: uuid.NullUUID{UUID: fileID, Valid: true},
		UserID: uuid.NullUUID{UUID: user.ID, Valid: true},
	})
	hasAccess := false
	wrappedKey := ""
	if err == nil {
		hasAccess = true
		wrappedKey = accessKey.WrappedKey
	} else if err == sql.ErrNoRows {
		if dbFile.OwnerID.Valid && dbFile.OwnerID.UUID == user.ID {
			hasAccess = true
		} else {
			groupWrappedKey, groupErr := cfg.dbQueries.GetGroupWrappedKeyForUser(r.Context(), database.GetGroupWrappedKeyForUserParams{
				FileID: fileID,
				UserID: user.ID,
			})
			if groupErr == nil {
				hasAccess = true
				wrappedKey = groupWrappedKey
			}
		}
	}
	if !hasAccess {
		respondWithV1Error(w, r, http.StatusForbidden, "You do not have access to this file")
		return
	}
	file, err := os.Open(dbFile.FilePath)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not read file from disk")
		return
	}
	defer file.Close()
	w.Header().Set("Content-Disposition", "attachment; filename=\""+dbFile.Filename+"\"")
	w.Header().Set("Content-Type", "application/octet-stream")
	ensureRequestID(w, r)
	if dbFile.EncryptedMetadata.Valid {
		w.Header().Set("X-File-Metadata", dbFile.EncryptedMetadata.String)
	}
	if wrappedKey != "" {
		w.Header().Set("X-Wrapped-Key", wrappedKey)
	}
	_, _ = io.Copy(w, file)
}

func (cfg *ApiConfig) handlerV1ListFolders(w http.ResponseWriter, r *http.Request, user database.User) {
	folders, err := cfg.dbQueries.GetFoldersByOwner(r.Context(), user.ID)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to list folders")
		return
	}
	items := make([]FolderResponse, 0, len(folders))
	for _, folder := range folders {
		items = append(items, toFolderResponse(folder))
	}
	respondWithV1(w, r, http.StatusOK, items, map[string]int{"count": len(items)})
}

func (cfg *ApiConfig) handlerV1CreateFolder(w http.ResponseWriter, r *http.Request, user database.User) {
	var req struct {
		Name     string `json:"name"`
		ParentID string `json:"parentId,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		respondWithV1Error(w, r, http.StatusBadRequest, "Name is required")
		return
	}
	var parentUUID uuid.NullUUID
	if req.ParentID != "" {
		parsedParentID, err := uuid.Parse(req.ParentID)
		if err != nil {
			respondWithV1Error(w, r, http.StatusBadRequest, "Invalid parent ID format")
			return
		}
		parentFolder, err := cfg.dbQueries.GetFolderByID(r.Context(), parsedParentID)
		if err != nil || parentFolder.OwnerID != user.ID {
			respondWithV1Error(w, r, http.StatusForbidden, "Parent folder is not available")
			return
		}
		parentUUID = uuid.NullUUID{UUID: parsedParentID, Valid: true}
	}
	folder, err := cfg.dbQueries.CreateFolder(r.Context(), database.CreateFolderParams{
		OwnerID:   user.ID,
		Name:      req.Name,
		ParentID:  parentUUID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to create folder")
		return
	}
	respondWithV1(w, r, http.StatusCreated, toFolderResponse(folder), nil)
}

func (cfg *ApiConfig) handlerV1UpdateFolder(w http.ResponseWriter, r *http.Request, user database.User) {
	var req struct {
		Name     string `json:"name"`
		ParentID string `json:"parentId,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	folderID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid folder ID")
		return
	}
	var parentUUID uuid.NullUUID
	if req.ParentID != "" {
		parsedParentID, err := uuid.Parse(req.ParentID)
		if err != nil || parsedParentID == folderID {
			respondWithV1Error(w, r, http.StatusBadRequest, "Invalid parent ID")
			return
		}
		parentFolder, err := cfg.dbQueries.GetFolderByID(r.Context(), parsedParentID)
		if err != nil || parentFolder.OwnerID != user.ID {
			respondWithV1Error(w, r, http.StatusForbidden, "Parent folder is not available")
			return
		}
		parentUUID = uuid.NullUUID{UUID: parsedParentID, Valid: true}
	}
	updated, err := cfg.dbQueries.UpdateFolder(r.Context(), database.UpdateFolderParams{
		ID:        folderID,
		Name:      req.Name,
		ParentID:  parentUUID,
		UpdatedAt: time.Now().UTC(),
		OwnerID:   user.ID,
	})
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to update folder")
		return
	}
	respondWithV1(w, r, http.StatusOK, toFolderResponse(updated), nil)
}

func (cfg *ApiConfig) handlerV1DeleteFolder(w http.ResponseWriter, r *http.Request, user database.User) {
	folderID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid folder ID")
		return
	}
	if err := cfg.dbQueries.DeleteFolder(r.Context(), database.DeleteFolderParams{
		ID:      folderID,
		OwnerID: user.ID,
	}); err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to delete folder")
		return
	}
	respondWithV1(w, r, http.StatusOK, map[string]string{"status": "deleted"}, nil)
}
