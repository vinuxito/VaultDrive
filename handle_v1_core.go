package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func (cfg *ApiConfig) handlerV1ListFiles(w http.ResponseWriter, r *http.Request, user database.User) {
	files, err := cfg.dbQueries.GetFilesWithDropSource(r.Context(), uuid.NullUUID{UUID: user.ID, Valid: true})
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not retrieve files")
		return
	}
	query := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	if query == "" {
		query = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))
	}
	rawFolderID := strings.TrimSpace(r.URL.Query().Get("folder_id"))
	var filterFolderID uuid.UUID
	filterRootOnly := false
	if rawFolderID == "root" {
		filterRootOnly = true
	} else if rawFolderID != "" {
		parsedFolderID, parseErr := uuid.Parse(rawFolderID)
		if parseErr != nil {
			respondWithV1Error(w, r, http.StatusBadRequest, "Invalid folder_id filter")
			return
		}
		filterFolderID = parsedFolderID
	}

	limit, offset := parseV1Pagination(r, 0, 500)
	actor, _ := actorFromContext(r.Context())
	hasJail, allowedFolders, jailErr := cfg.resolveActorAllowedFolderSet(r.Context(), actor)
	if jailErr != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to resolve folder scope")
		return
	}
	if hasJail {
		if filterRootOnly {
			cfg.denyFolderScope(w, r, nil, "API key is restricted to specific folders; root files are outside scope")
			return
		}
		if filterFolderID != uuid.Nil {
			if _, ok := allowedFolders[filterFolderID]; !ok {
				cfg.denyFolderScope(w, r, &filterFolderID, "Requested folder_id is outside this key's allowed_folder_ids")
				return
			}
		}
	}

	filtered := make([]map[string]interface{}, 0, len(files))
	for _, file := range files {
		if hasJail {
			if !file.FolderID.Valid {
				continue
			}
			if _, ok := allowedFolders[file.FolderID.UUID]; !ok {
				continue
			}
		}
		if query != "" && !strings.Contains(strings.ToLower(file.Filename), query) {
			continue
		}
		if filterRootOnly && file.FolderID.Valid {
			continue
		}
		if filterFolderID != uuid.Nil && (!file.FolderID.Valid || file.FolderID.UUID != filterFolderID) {
			continue
		}
		item := map[string]interface{}{
			"id":         file.ID.String(),
			"filename":   file.Filename,
			"file_size":  file.FileSize,
			"created_at": file.CreatedAt,
			"updated_at": file.UpdatedAt,
			"starred":    file.Starred,
			"is_owner":   true,
		}
		if file.FolderID.Valid {
			item["folder_id"] = file.FolderID.UUID.String()
		} else {
			item["folder_id"] = nil
		}
		if file.EncryptedMetadata.Valid {
			item["metadata"] = file.EncryptedMetadata.String
		}
		if file.DropSourceID.Valid {
			item["origin"] = "secure_drop"
		} else {
			item["origin"] = "vault_upload"
		}
		filtered = append(filtered, item)
	}

	total := len(filtered)
	items := filtered
	if offset > 0 {
		if offset >= len(items) {
			items = []map[string]interface{}{}
		} else {
			items = items[offset:]
		}
	}
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}

	respondWithV1(w, r, http.StatusOK, items, map[string]interface{}{
		"count":  len(items),
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func (cfg *ApiConfig) handlerV1GetFileMetadata(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, err := cfg.getOwnedFileForAccessResult(r.Context(), r.PathValue("id"), user)
	if err != nil {
		respondAccessLookupError(w, r, err, true)
		return
	}
	if !cfg.enforceFolderJailForFile(w, r, dbFile) {
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
	if dbFile.FolderID.Valid {
		entry["folder_id"] = dbFile.FolderID.UUID.String()
	} else {
		entry["folder_id"] = nil
	}
	if dbFile.EncryptedMetadata.Valid {
		entry["metadata"] = dbFile.EncryptedMetadata.String
	}
	respondWithV1(w, r, http.StatusOK, entry, nil)
}

func (cfg *ApiConfig) handlerV1CreateFile(w http.ResponseWriter, r *http.Request, user database.User) {
	idemKey, keyScope, ok := resolveV1IdempotencyScope(w, r, user)
	if !ok {
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Could not parse multipart form")
		return
	}

	wrappedKey := r.FormValue("wrapped_key")
	if strings.TrimSpace(wrappedKey) == "" {
		respondWithV1Error(w, r, http.StatusBadRequest, "wrapped_key is required")
		return
	}

	rawFolderID := strings.TrimSpace(r.FormValue("folder_id"))
	var folderUUID uuid.NullUUID
	if rawFolderID != "" {
		parsedFolderID, err := uuid.Parse(rawFolderID)
		if err != nil {
			respondWithV1Error(w, r, http.StatusBadRequest, "Invalid folder_id")
			return
		}
		folder, err := cfg.dbQueries.GetFolderByID(r.Context(), parsedFolderID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				respondWithV1Error(w, r, http.StatusNotFound, "Folder not found")
				return
			}
			respondWithV1Error(w, r, http.StatusInternalServerError, "Could not verify folder")
			return
		}
		if folder.OwnerID != user.ID {
			respondWithV1Error(w, r, http.StatusForbidden, "You do not own the target folder")
			return
		}
		folderUUID = uuid.NullUUID{UUID: parsedFolderID, Valid: true}
	}
	var targetFolderPtr *uuid.UUID
	if folderUUID.Valid {
		id := folderUUID.UUID
		targetFolderPtr = &id
	}
	if !cfg.enforceFolderJailID(w, r, targetFolderPtr, false) {
		return
	}

	metadataJSON, credentialScheme, err := parseV1UploadMetadata(
		r.FormValue("metadata"),
		r.FormValue("credential_scheme"),
		r.FormValue("iv"),
		r.FormValue("algorithm"),
		r.FormValue("salt"),
		wrappedKey,
	)
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, err.Error())
		return
	}
	if credentialScheme == "folder" && !folderUUID.Valid {
		respondWithV1Error(w, r, http.StatusBadRequest, "folder_id is required when credential_scheme is \"folder\"")
		return
	}
	if credentialScheme == "" {
		credentialScheme = "password"
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Encrypted file is required")
		return
	}
	defer file.Close()

	reqHash := ""
	if idemKey != "" {
		var hashErr error
		reqHash, hashErr = buildV1MultipartUploadIdempotencyHash(
			r,
			file,
			handler.Filename,
			rawFolderID,
			wrappedKey,
			metadataJSON,
			credentialScheme,
		)
		if hashErr != nil {
			respondWithV1Error(w, r, http.StatusInternalServerError, "Could not fingerprint uploaded file for idempotency")
			return
		}
		if cfg.tryReplayV1Idempotency(w, r, keyScope, idemKey, reqHash) {
			return
		}
	}

	executeUpload := func(outW http.ResponseWriter) {
		uploadDir := uploadStorageDir()
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			respondWithV1Error(outW, r, http.StatusInternalServerError, "Could not create uploads directory")
			return
		}
		filename := uuid.New().String() + filepath.Ext(handler.Filename)
		filePath := filepath.Join(uploadDir, filename)
		dst, err := os.Create(filePath)
		if err != nil {
			respondWithV1Error(outW, r, http.StatusInternalServerError, "Could not create file on server")
			return
		}
		defer dst.Close()
		if _, err := io.Copy(dst, file); err != nil {
			_ = os.Remove(filePath)
			respondWithV1Error(outW, r, http.StatusInternalServerError, "Could not save file")
			return
		}

		dbFile, err := cfg.dbQueries.CreateFile(r.Context(), database.CreateFileParams{
			OwnerID:           uuid.NullUUID{UUID: user.ID, Valid: true},
			Filename:          handler.Filename,
			FilePath:          filePath,
			FileSize:          handler.Size,
			EncryptedMetadata: sql.NullString{String: metadataJSON, Valid: true},
			CurrentKeyVersion: sql.NullInt32{Int32: 1, Valid: true},
			CreatedAt:         time.Now().UTC(),
			UpdatedAt:         time.Now().UTC(),
			DropSourceID:      uuid.NullUUID{},
			FolderID:          folderUUID,
		})
		if err != nil {
			_ = os.Remove(filePath)
			respondWithV1Error(outW, r, http.StatusInternalServerError, "Could not create file entry")
			return
		}

		if _, err := cfg.dbQueries.CreateFileAccessKey(r.Context(), database.CreateFileAccessKeyParams{
			FileID:     uuid.NullUUID{UUID: dbFile.ID, Valid: true},
			UserID:     uuid.NullUUID{UUID: user.ID, Valid: true},
			WrappedKey: wrappedKey,
		}); err != nil {
			_ = os.Remove(filePath)
			_ = cfg.dbQueries.DeleteFile(r.Context(), dbFile.ID)
			respondWithV1Error(outW, r, http.StatusInternalServerError, "Could not save file access key")
			return
		}
		cfg.insertActivity(r.Context(), user.ID, "file_upload", map[string]interface{}{
			"file_id":   dbFile.ID.String(),
			"filename":  dbFile.Filename,
			"file_size": dbFile.FileSize,
		})
		cfg.insertAudit(r.Context(), user.ID, "file.uploaded", "file", &dbFile.ID, map[string]interface{}{
			"filename":          dbFile.Filename,
			"file_size":         dbFile.FileSize,
			"credential_scheme": credentialScheme,
		}, r)

		var respFolderID any
		if dbFile.FolderID.Valid {
			respFolderID = dbFile.FolderID.UUID.String()
		}
		respondWithV1(outW, r, http.StatusCreated, map[string]interface{}{
			"id":                 dbFile.ID.String(),
			"filename":           dbFile.Filename,
			"file_size":          dbFile.FileSize,
			"folder_id":          respFolderID,
			"credential_scheme":  credentialScheme,
			"wrapped_key_stored": true,
			"created_at":         dbFile.CreatedAt,
		}, nil)
	}

	if idemKey != "" {
		cfg.recordAndFlushV1Idempotency(w, r, keyScope, idemKey, reqHash, executeUpload)
		return
	}
	executeUpload(w)
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
	if !cfg.enforceFolderJailForFile(w, r, dbFile) {
		return
	}
	hasAccess := false
	wrappedKey := ""
	folderWrappedKey := ""

	if accessKey, akErr := cfg.dbQueries.GetFileAccessKey(r.Context(), database.GetFileAccessKeyParams{
		FileID: uuid.NullUUID{UUID: fileID, Valid: true},
		UserID: uuid.NullUUID{UUID: user.ID, Valid: true},
	}); akErr == nil {
		hasAccess = true
		wrappedKey = accessKey.WrappedKey
	}

	if !hasAccess {
		canAccess, _, shareWrapped, err := cfg.userCanAccessFile(r.Context(), dbFile, user.ID)
		if err != nil {
			respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to verify file access")
			return
		}
		if canAccess {
			hasAccess = true
			if dbFile.OwnerID.Valid && dbFile.OwnerID.UUID == user.ID {
				wrappedKey = cfg.resolveV1FileWrappedKey(r.Context(), dbFile, user.ID, "")
			} else if dbFile.FolderID.Valid && shareWrapped != "" {
				// Collaborator accessing via folder share gets file's wrapped key (often folder-wrapped)
				// and the collaborator's own folder key in X-Folder-Wrapped-Key.
				folderWrappedKey = shareWrapped
				wrappedKey = cfg.resolveV1FileWrappedKey(r.Context(), dbFile, user.ID, "")
			} else {
				wrappedKey = cfg.resolveV1FileWrappedKey(r.Context(), dbFile, user.ID, shareWrapped)
			}
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
	} else if wrappedKey == "" && dbFile.FolderID.Valid {
		wrappedKey = cfg.resolveV1FileWrappedKey(r.Context(), dbFile, user.ID, "")
	}

	if !hasAccess {
		respondWithV1Error(w, r, http.StatusForbidden, "You do not have access to this file")
		return
	}
	storagePath, err := resolveStoredFilePath(dbFile.FilePath)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Stored file path is invalid")
		return
	}
	file, err := os.Open(storagePath)
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
	if scheme := extractMetadataCredentialScheme(dbFile.EncryptedMetadata); scheme != "" {
		w.Header().Set("X-Credential-Scheme", scheme)
	}
	if wrappedKey != "" {
		w.Header().Set("X-Wrapped-Key", wrappedKey)
	}
	if folderWrappedKey != "" {
		w.Header().Set("X-Folder-Wrapped-Key", folderWrappedKey)
	}
	// Record the actual stream outcome with the authenticated actor scope.
	var actorType = "owner"
	var actorDetails = map[string]interface{}{}
	if actor, ok := actorFromContext(r.Context()); ok {
		if actor.AuthType == "agent_api_key" {
			actorType = "agent_key"
			if actor.KeyID != nil {
				var keyName, keyPrefix string
				_ = cfg.db.QueryRowContext(r.Context(), "SELECT name, key_prefix FROM agent_api_keys WHERE id = $1", actor.KeyID).Scan(&keyName, &keyPrefix)
				actorDetails["key_name"] = keyName
				actorDetails["key_prefix"] = keyPrefix
			}
		} else if actor.User.ID != dbFile.OwnerID.UUID {
			actorType = "user"
			actorDetails["email"] = actor.User.Email
		} else {
			actorDetails["email"] = actor.User.Email
		}
	}
	actorDetails["actor_type"] = actorType
	actorDetails["filename"] = dbFile.Filename
	actorDetails["file_size"] = dbFile.FileSize

	cfg.streamDownload(w, r, file, dbFile.OwnerID.UUID, dbFile.ID, actorDetails)
}

func (cfg *ApiConfig) handlerV1ListFolders(w http.ResponseWriter, r *http.Request, user database.User) {
	folders, err := cfg.dbQueries.GetFoldersByOwner(r.Context(), user.ID)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to list folders")
		return
	}
	actor, _ := actorFromContext(r.Context())
	hasJail, allowedFolders, jailErr := cfg.resolveActorAllowedFolderSet(r.Context(), actor)
	if jailErr != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to resolve folder scope")
		return
	}
	items := make([]FolderResponse, 0, len(folders))
	for _, folder := range folders {
		if hasJail {
			if _, ok := allowedFolders[folder.ID]; !ok {
				continue
			}
		}
		items = append(items, toFolderResponse(folder))
	}
	respondWithV1(w, r, http.StatusOK, items, map[string]int{"count": len(items)})
}

type v1FolderWritePayload struct {
	Name     string
	ParentID string
}

func decodeV1FolderWriteRequest(w http.ResponseWriter, r *http.Request) (v1FolderWritePayload, bool) {
	var raw struct {
		Name          string `json:"name"`
		ParentID      string `json:"parentId,omitempty"`
		ParentIDSnake string `json:"parent_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid request body")
		return v1FolderWritePayload{}, false
	}
	camel := strings.TrimSpace(raw.ParentID)
	snake := strings.TrimSpace(raw.ParentIDSnake)
	if camel != "" && snake != "" && camel != snake {
		respondWithV1ErrorCode(w, r, http.StatusBadRequest, "validation_error", "Conflicting parentId and parent_id values")
		return v1FolderWritePayload{}, false
	}
	parentID := camel
	if parentID == "" {
		parentID = snake
	}
	return v1FolderWritePayload{
		Name:     raw.Name,
		ParentID: parentID,
	}, true
}

func (cfg *ApiConfig) handlerV1CreateFolder(w http.ResponseWriter, r *http.Request, user database.User) {
	req, ok := decodeV1FolderWriteRequest(w, r)
	if !ok {
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
	var parentPtr *uuid.UUID
	if parentUUID.Valid {
		id := parentUUID.UUID
		parentPtr = &id
	}
	if !cfg.enforceFolderJailID(w, r, parentPtr, false) {
		return
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
	req, ok := decodeV1FolderWriteRequest(w, r)
	if !ok {
		return
	}
	folderID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid folder ID")
		return
	}
	existingFolder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithV1Error(w, r, http.StatusNotFound, "Folder not found")
			return
		}
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to inspect folder")
		return
	}
	if existingFolder.OwnerID != user.ID {
		respondWithV1Error(w, r, http.StatusForbidden, "You do not own this folder")
		return
	}
	if !cfg.enforceFolderJailID(w, r, &folderID, false) {
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
		if !cfg.enforceFolderJailID(w, r, &parsedParentID, false) {
			return
		}
		parentUUID = uuid.NullUUID{UUID: parsedParentID, Valid: true}
	} else if existingFolder.ParentID.Valid {
		// Attempting to detach a nested folder out to root is blocked when folder-jailed.
		if !cfg.enforceFolderJailID(w, r, nil, false) {
			return
		}
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
