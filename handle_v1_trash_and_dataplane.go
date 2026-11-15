package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func parseV1Pagination(r *http.Request, defaultLimit, maxLimit int) (int, int) {
	limit := defaultLimit
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			limit = v
		}
	}
	if maxLimit > 0 && limit > maxLimit {
		limit = maxLimit
	}
	offset := 0
	if raw := strings.TrimSpace(r.URL.Query().Get("offset")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v >= 0 {
			offset = v
		}
	}
	return limit, offset
}

func (cfg *ApiConfig) updateFileMetadataScheme(ctx context.Context, file database.File, scheme, wrappedKey string, now time.Time) {
	meta := map[string]interface{}{}
	if file.EncryptedMetadata.Valid && strings.TrimSpace(file.EncryptedMetadata.String) != "" {
		_ = json.Unmarshal([]byte(file.EncryptedMetadata.String), &meta)
	}
	if scheme != "" {
		meta["credential_scheme"] = scheme
	}
	if wrappedKey != "" {
		meta["wrapped_key"] = wrappedKey
	}
	raw, err := json.Marshal(meta)
	if err != nil {
		return
	}
	_, _ = cfg.dbQueries.UpdateFileMetadata(ctx, database.UpdateFileMetadataParams{
		ID:                file.ID,
		EncryptedMetadata: sql.NullString{String: string(raw), Valid: true},
		CurrentKeyVersion: file.CurrentKeyVersion,
		UpdatedAt:         now,
	})
}

func readOptionalDeleteReason(r *http.Request) string {
	reason := strings.TrimSpace(r.URL.Query().Get("reason"))
	if reason == "" && r.Body != nil {
		var body struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err == nil {
			reason = strings.TrimSpace(body.Reason)
		}
	}
	if len(reason) > 280 {
		reason = reason[:280]
	}
	if reason == "" {
		reason = "Enviado a Papelera recuperable"
	}
	return reason
}

func actorAuditFields(ctx context.Context) (string, *uuid.UUID) {
	actor, ok := actorFromContext(ctx)
	if !ok || actor == nil || actor.AuthType != "agent_api_key" {
		return "human_jwt", nil
	}
	return "agent_delete_key", actor.KeyID
}

func (cfg *ApiConfig) softDeleteFileWithActor(
	ctx context.Context,
	ownerID uuid.UUID,
	fileID uuid.UUID,
	actorType string,
	keyID *uuid.UUID,
	reason string,
	r *http.Request,
) (database.File, error) {
	now := time.Now().UTC()
	var nullKeyID uuid.NullUUID
	if keyID != nil {
		nullKeyID = uuid.NullUUID{UUID: *keyID, Valid: true}
	}
	file, err := cfg.dbQueries.SoftDeleteFile(ctx, database.SoftDeleteFileParams{
		ID:                 fileID,
		OwnerID:            uuid.NullUUID{UUID: ownerID, Valid: true},
		DeletedAt:          sql.NullTime{Time: now, Valid: true},
		DeletedByActorType: sql.NullString{String: actorType, Valid: actorType != ""},
		DeletedByKeyID:     nullKeyID,
		DeletedReason:      sql.NullString{String: reason, Valid: reason != ""},
	})
	if err != nil {
		return database.File{}, err
	}

	auditMeta := map[string]interface{}{
		"filename":    file.Filename,
		"actor_type":  actorType,
		"reason":      reason,
		"recoverable": true,
	}
	if keyID != nil {
		auditMeta["key_id"] = keyID.String()
	}
	cfg.insertActivity(ctx, ownerID, "file_soft_deleted", auditMeta)
	cfg.insertAudit(ctx, ownerID, "file.soft_deleted", "file", &file.ID, auditMeta, r)
	if actorType == "agent_delete_key" && keyID != nil {
		broadcastAgentOperation(ownerID, "file.soft_deleted", map[string]interface{}{
			"key_id":      keyID.String(),
			"resource":    "/api/v1/files/" + file.ID.String(),
			"result":      "trashed",
			"method":      http.MethodDelete,
			"recoverable": true,
			"reason":      reason,
		})
	}
	return file, nil
}

func (cfg *ApiConfig) softDeleteFolderTreeWithActor(
	ctx context.Context,
	ownerID uuid.UUID,
	folderID uuid.UUID,
	actorType string,
	keyID *uuid.UUID,
	reason string,
	r *http.Request,
) (int, int, error) {
	tx, err := cfg.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	qtx := cfg.dbQueries.WithTx(tx)
	subtreeIDs, err := qtx.GetActiveFolderSubtreeIDs(ctx, database.GetActiveFolderSubtreeIDsParams{
		ID:      folderID,
		OwnerID: ownerID,
	})
	if err != nil {
		return 0, 0, err
	}
	if len(subtreeIDs) == 0 {
		return 0, 0, sql.ErrNoRows
	}

	now := time.Now().UTC()
	var nullKeyID uuid.NullUUID
	if keyID != nil {
		nullKeyID = uuid.NullUUID{UUID: *keyID, Valid: true}
	}

	trashedFolders, err := qtx.SoftDeleteFoldersByIDs(ctx, database.SoftDeleteFoldersByIDsParams{
		OwnerID:            ownerID,
		Column2:            subtreeIDs,
		DeletedAt:          sql.NullTime{Time: now, Valid: true},
		DeletedByActorType: sql.NullString{String: actorType, Valid: actorType != ""},
		DeletedByKeyID:     nullKeyID,
		DeletedReason:      sql.NullString{String: reason, Valid: reason != ""},
	})
	if err != nil {
		return 0, 0, err
	}

	trashedFiles, err := qtx.SoftDeleteFilesByFolderIDs(ctx, database.SoftDeleteFilesByFolderIDsParams{
		OwnerID:            uuid.NullUUID{UUID: ownerID, Valid: true},
		Column2:            subtreeIDs,
		DeletedAt:          sql.NullTime{Time: now, Valid: true},
		DeletedByActorType: sql.NullString{String: actorType, Valid: actorType != ""},
		DeletedByKeyID:     nullKeyID,
		DeletedReason:      sql.NullString{String: reason, Valid: reason != ""},
	})
	if err != nil {
		return 0, 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}

	auditMeta := map[string]interface{}{
		"folder_id":       folderID.String(),
		"trashed_folders": len(trashedFolders),
		"trashed_files":   len(trashedFiles),
		"actor_type":      actorType,
		"reason":          reason,
		"recoverable":     true,
	}
	if keyID != nil {
		auditMeta["key_id"] = keyID.String()
	}
	cfg.insertActivity(ctx, ownerID, "folder_soft_deleted", auditMeta)
	cfg.insertAudit(ctx, ownerID, "folder.soft_deleted", "folder", &folderID, auditMeta, r)
	if actorType == "agent_delete_key" && keyID != nil {
		broadcastAgentOperation(ownerID, "folder.soft_deleted", map[string]interface{}{
			"key_id":      keyID.String(),
			"resource":    "/api/v1/folders/" + folderID.String(),
			"result":      "trashed",
			"method":      http.MethodDelete,
			"recoverable": true,
			"reason":      reason,
		})
	}
	return len(trashedFolders), len(trashedFiles), nil
}

func (cfg *ApiConfig) handlerV1DeleteFile(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid file ID")
		return
	}
	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithV1Error(w, r, http.StatusNotFound, "File not found")
			return
		}
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to retrieve file")
		return
	}
	if !dbFile.OwnerID.Valid || dbFile.OwnerID.UUID != user.ID {
		respondWithV1Error(w, r, http.StatusForbidden, "You do not own this file")
		return
	}
	if !cfg.enforceFolderJailForFile(w, r, dbFile) {
		return
	}

	actorType, keyID := actorAuditFields(r.Context())
	reason := readOptionalDeleteReason(r)
	updated, err := cfg.softDeleteFileWithActor(r.Context(), user.ID, fileID, actorType, keyID, reason, r)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithV1Error(w, r, http.StatusNotFound, "File not found or already in Trash")
			return
		}
		log.Printf("softDeleteFileWithActor(%s) error: %v", fileID, err)
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not move file to Trash")
		return
	}

	resp := map[string]interface{}{
		"id":                    updated.ID.String(),
		"resource_type":         "file",
		"filename":              updated.Filename,
		"recoverable":           true,
		"purged":                false,
		"deleted_by_actor_type": actorType,
		"deleted_reason":        reason,
		"deleted_at":            updated.DeletedAt.Time,
	}
	if keyID != nil {
		resp["deleted_by_key_id"] = keyID.String()
	}
	respondWithV1(w, r, http.StatusOK, resp, nil)
}

func (cfg *ApiConfig) handlerV1DeleteFolder(w http.ResponseWriter, r *http.Request, user database.User) {
	folderID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid folder ID")
		return
	}
	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithV1Error(w, r, http.StatusNotFound, "Folder not found")
			return
		}
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to retrieve folder")
		return
	}
	if folder.OwnerID != user.ID {
		respondWithV1Error(w, r, http.StatusForbidden, "You do not own this folder")
		return
	}
	if !cfg.enforceFolderJailID(w, r, &folderID, false) {
		return
	}

	actorType, keyID := actorAuditFields(r.Context())
	reason := readOptionalDeleteReason(r)
	trashedFolders, trashedFiles, err := cfg.softDeleteFolderTreeWithActor(r.Context(), user.ID, folderID, actorType, keyID, reason, r)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not move folder to Trash")
		return
	}

	resp := map[string]interface{}{
		"id":                    folderID.String(),
		"resource_type":         "folder",
		"name":                  folder.Name,
		"trashed_folders":       trashedFolders,
		"trashed_files":         trashedFiles,
		"recoverable":           true,
		"purged":                false,
		"deleted_by_actor_type": actorType,
		"deleted_reason":        reason,
		"deleted_at":            time.Now().UTC(),
	}
	if keyID != nil {
		resp["deleted_by_key_id"] = keyID.String()
	}
	respondWithV1(w, r, http.StatusOK, resp, nil)
}

func (cfg *ApiConfig) handlerV1FilesSync(w http.ResponseWriter, r *http.Request, user database.User) {
	actor, _ := actorFromContext(r.Context())
	if actor != nil && actor.AuthType == "agent_api_key" {
		rawBody, err := io.ReadAll(io.LimitReader(r.Body, (1<<20)+1))
		if err != nil {
			respondWithV1Error(w, r, http.StatusBadRequest, "Invalid request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(rawBody))

		var peek struct {
			Actions []struct {
				Type   string `json:"type"`
				FileID string `json:"file_id"`
			} `json:"actions"`
		}
		if err := json.Unmarshal(rawBody, &peek); err == nil {
			for _, action := range peek.Actions {
				if fidStr := strings.TrimSpace(action.FileID); fidStr != "" {
					if fid, parseErr := uuid.Parse(fidStr); parseErr == nil {
						if dbFile, fErr := cfg.dbQueries.GetFileByID(r.Context(), fid); fErr == nil && dbFile.OwnerID.Valid && dbFile.OwnerID.UUID == user.ID {
							if !cfg.enforceFolderJailForFile(w, r, dbFile) {
								return
							}
						}
					}
				}
				if action.Type == "delete" {
					if actor.KeyKind != agentKeyKindDeleteOnly || !scopeAllowed(actor.Scopes, scopeFilesSoftDelete) {
						respondWithV1ErrorCode(w, r, http.StatusForbidden, "delete_key_required", "Standard agent keys cannot delete files during sync. Use a Special Delete-Only key (abrnak_del_).")
						return
					}
				} else {
					if actor.KeyKind == agentKeyKindDeleteOnly {
						respondWithV1ErrorCode(w, r, http.StatusForbidden, "insufficient_scope", "Special Delete-Only keys cannot perform rename or non-delete sync actions")
						return
					}
					if !scopeAllowed(actor.Scopes, "files:write") && !scopeAllowed(actor.Scopes, "folders:write") {
						respondWithV1ErrorCode(w, r, http.StatusForbidden, "insufficient_scope", "API key requires files:write scope for rename sync actions")
						return
					}
				}
			}
		}
	}
	cfg.handlerFilesSync(w, r, user)
}

func ensureHumanJWTOrForbid(w http.ResponseWriter, r *http.Request) bool {
	if actor, ok := actorFromContext(r.Context()); ok && actor != nil && actor.AuthType == "agent_api_key" {
		respondWithV1ErrorCode(w, r, http.StatusForbidden, "human_jwt_required", "Trash restore and permanent purge belong strictly to the human vault owner inside the app")
		return false
	}
	return true
}

func (cfg *ApiConfig) handlerListTrash(w http.ResponseWriter, r *http.Request, user database.User) {
	if !ensureHumanJWTOrForbid(w, r) {
		return
	}
	trashedFiles, err := cfg.dbQueries.ListTrashedFilesByOwner(r.Context(), uuid.NullUUID{UUID: user.ID, Valid: true})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not list trashed files", err)
		return
	}
	trashedFolders, err := cfg.dbQueries.ListTrashedFoldersByOwner(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not list trashed folders", err)
		return
	}

	type trashFileEntry struct {
		ID                 string     `json:"id"`
		Filename           string     `json:"filename"`
		FileSize           int64      `json:"file_size"`
		FolderID           *string    `json:"folder_id,omitempty"`
		DeletedAt          *time.Time `json:"deleted_at,omitempty"`
		DeletedByActorType string     `json:"deleted_by_actor_type,omitempty"`
		DeletedByKeyID     *string    `json:"deleted_by_key_id,omitempty"`
		DeletedByKeyName   string     `json:"deleted_by_key_name,omitempty"`
		DeletedByKeyPrefix string     `json:"deleted_by_key_prefix,omitempty"`
		DeletedReason      string     `json:"deleted_reason,omitempty"`
		CreatedAt          time.Time  `json:"created_at"`
		UpdatedAt          time.Time  `json:"updated_at"`
	}
	type trashFolderEntry struct {
		ID                 string     `json:"id"`
		Name               string     `json:"name"`
		ParentID           *string    `json:"parent_id,omitempty"`
		DeletedAt          *time.Time `json:"deleted_at,omitempty"`
		DeletedByActorType string     `json:"deleted_by_actor_type,omitempty"`
		DeletedByKeyID     *string    `json:"deleted_by_key_id,omitempty"`
		DeletedByKeyName   string     `json:"deleted_by_key_name,omitempty"`
		DeletedByKeyPrefix string     `json:"deleted_by_key_prefix,omitempty"`
		DeletedReason      string     `json:"deleted_reason,omitempty"`
		CreatedAt          time.Time  `json:"created_at"`
	}

	filesOut := make([]trashFileEntry, 0, len(trashedFiles))
	for _, f := range trashedFiles {
		item := trashFileEntry{
			ID:                 f.ID.String(),
			Filename:           f.Filename,
			FileSize:           f.FileSize,
			DeletedByActorType: f.DeletedByActorType.String,
			DeletedByKeyName:   f.DeletedByKeyName.String,
			DeletedByKeyPrefix: f.DeletedByKeyPrefix.String,
			DeletedReason:      f.DeletedReason.String,
			CreatedAt:          f.CreatedAt,
			UpdatedAt:          f.UpdatedAt,
		}
		if f.FolderID.Valid {
			s := f.FolderID.UUID.String()
			item.FolderID = &s
		}
		if f.DeletedAt.Valid {
			t := f.DeletedAt.Time
			item.DeletedAt = &t
		}
		if f.DeletedByKeyID.Valid {
			s := f.DeletedByKeyID.UUID.String()
			item.DeletedByKeyID = &s
		}
		filesOut = append(filesOut, item)
	}

	foldersOut := make([]trashFolderEntry, 0, len(trashedFolders))
	for _, fol := range trashedFolders {
		item := trashFolderEntry{
			ID:                 fol.ID.String(),
			Name:               fol.Name,
			DeletedByActorType: fol.DeletedByActorType.String,
			DeletedByKeyName:   fol.DeletedByKeyName.String,
			DeletedByKeyPrefix: fol.DeletedByKeyPrefix.String,
			DeletedReason:      fol.DeletedReason.String,
			CreatedAt:          fol.CreatedAt,
		}
		if fol.ParentID.Valid {
			s := fol.ParentID.UUID.String()
			item.ParentID = &s
		}
		if fol.DeletedAt.Valid {
			t := fol.DeletedAt.Time
			item.DeletedAt = &t
		}
		if fol.DeletedByKeyID.Valid {
			s := fol.DeletedByKeyID.UUID.String()
			item.DeletedByKeyID = &s
		}
		foldersOut = append(foldersOut, item)
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"files":   filesOut,
		"folders": foldersOut,
	})
}

func (cfg *ApiConfig) handlerRestoreTrashedFile(w http.ResponseWriter, r *http.Request, user database.User) {
	if !ensureHumanJWTOrForbid(w, r) {
		return
	}
	fileID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}
	restored, err := cfg.dbQueries.RestoreTrashedFile(r.Context(), database.RestoreTrashedFileParams{
		ID:        fileID,
		OwnerID:   uuid.NullUUID{UUID: user.ID, Valid: true},
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "Trashed file not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Could not restore file from Trash", err)
		return
	}

	cfg.insertActivity(r.Context(), user.ID, "file_restored", map[string]interface{}{
		"file_id":  restored.ID.String(),
		"filename": restored.Filename,
	})
	cfg.insertAudit(r.Context(), user.ID, "file.restored", "file", &restored.ID, map[string]interface{}{
		"filename": restored.Filename,
	}, r)

	var folderIDOut *string
	if restored.FolderID.Valid {
		s := restored.FolderID.UUID.String()
		folderIDOut = &s
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"restored":  true,
		"id":        restored.ID.String(),
		"filename":  restored.Filename,
		"folder_id": folderIDOut,
	})
}

func (cfg *ApiConfig) handlerRestoreTrashedFolder(w http.ResponseWriter, r *http.Request, user database.User) {
	if !ensureHumanJWTOrForbid(w, r) {
		return
	}
	folderID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID", err)
		return
	}

	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not start restore transaction", err)
		return
	}
	defer tx.Rollback()

	qtx := cfg.dbQueries.WithTx(tx)
	subtreeIDs, err := qtx.GetTrashedFolderSubtreeIDs(r.Context(), database.GetTrashedFolderSubtreeIDsParams{
		ID:      folderID,
		OwnerID: user.ID,
	})
	if err != nil || len(subtreeIDs) == 0 {
		respondWithError(w, http.StatusNotFound, "Trashed folder not found", err)
		return
	}

	now := time.Now().UTC()
	rootFolder, err := qtx.RestoreTrashedRootFolder(r.Context(), database.RestoreTrashedRootFolderParams{
		ID:        folderID,
		OwnerID:   user.ID,
		UpdatedAt: now,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not restore root folder", err)
		return
	}
	restoredFolders, err := qtx.RestoreTrashedFoldersByIDs(r.Context(), database.RestoreTrashedFoldersByIDsParams{
		OwnerID:   user.ID,
		Column2:   subtreeIDs,
		UpdatedAt: now,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not restore folder subtree", err)
		return
	}
	restoredFiles, err := qtx.RestoreTrashedFilesByFolderIDs(r.Context(), database.RestoreTrashedFilesByFolderIDsParams{
		OwnerID:   uuid.NullUUID{UUID: user.ID, Valid: true},
		Column2:   subtreeIDs,
		UpdatedAt: now,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not restore folder files", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not finalize folder restore", err)
		return
	}

	cfg.insertActivity(r.Context(), user.ID, "folder_restored", map[string]interface{}{
		"folder_id":        folderID.String(),
		"name":             rootFolder.Name,
		"restored_folders": len(restoredFolders) + 1,
		"restored_files":   len(restoredFiles),
	})
	cfg.insertAudit(r.Context(), user.ID, "folder.restored", "folder", &folderID, map[string]interface{}{
		"name":             rootFolder.Name,
		"restored_folders": len(restoredFolders) + 1,
		"restored_files":   len(restoredFiles),
	}, r)

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"restored":         true,
		"id":               rootFolder.ID.String(),
		"name":             rootFolder.Name,
		"restored_folders": len(restoredFolders) + 1,
		"restored_files":   len(restoredFiles),
	})
}

func (cfg *ApiConfig) handlerPurgeTrashedFile(w http.ResponseWriter, r *http.Request, user database.User) {
	if !ensureHumanJWTOrForbid(w, r) {
		return
	}
	fileID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}
	trashed, err := cfg.dbQueries.GetTrashedFileByIDForOwner(r.Context(), database.GetTrashedFileByIDForOwnerParams{
		ID:      fileID,
		OwnerID: uuid.NullUUID{UUID: user.ID, Valid: true},
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "Trashed file not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Could not retrieve trashed file", err)
		return
	}

	storagePath, pathErr := resolveStoredFilePath(trashed.FilePath)
	if pathErr != nil {
		respondWithError(w, http.StatusInternalServerError, "Stored file path is invalid", pathErr)
		return
	}
	if _, err := cfg.dbQueries.DeleteTrashedFilePermanent(r.Context(), database.DeleteTrashedFilePermanentParams{
		ID:      fileID,
		OwnerID: uuid.NullUUID{UUID: user.ID, Valid: true},
	}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not permanently remove file record", err)
		return
	}
	if err := os.Remove(storagePath); err != nil && !os.IsNotExist(err) {
		respondWithError(w, http.StatusInternalServerError, "File record removed but ciphertext removal failed", err)
		return
	}

	cfg.insertActivity(r.Context(), user.ID, "file_purged_permanently", map[string]interface{}{
		"file_id":  fileID.String(),
		"filename": trashed.Filename,
	})
	cfg.insertAudit(r.Context(), user.ID, "file.purged_permanently", "file", &fileID, map[string]interface{}{
		"filename": trashed.Filename,
	}, r)

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"purged":  true,
		"id":      fileID.String(),
		"message": "File permanently erased from Trash and storage",
	})
}

func (cfg *ApiConfig) handlerPurgeTrashedFolder(w http.ResponseWriter, r *http.Request, user database.User) {
	if !ensureHumanJWTOrForbid(w, r) {
		return
	}
	folderID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID", err)
		return
	}
	rootFolder, err := cfg.dbQueries.GetTrashedFolderByIDForOwner(r.Context(), database.GetTrashedFolderByIDForOwnerParams{
		ID:      folderID,
		OwnerID: user.ID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "Trashed folder not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Could not retrieve trashed folder", err)
		return
	}

	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not start purge transaction", err)
		return
	}
	defer tx.Rollback()

	qtx := cfg.dbQueries.WithTx(tx)
	subtreeIDs, err := qtx.GetAnyFolderSubtreeIDsForOwner(r.Context(), database.GetAnyFolderSubtreeIDsForOwnerParams{
		ID:      folderID,
		OwnerID: user.ID,
	})
	if err != nil || len(subtreeIDs) == 0 {
		respondWithError(w, http.StatusNotFound, "Trashed folder tree not found", err)
		return
	}

	filesInTree, err := qtx.ListAllFilesInFolderIDsForOwner(r.Context(), database.ListAllFilesInFolderIDsForOwnerParams{
		OwnerID: uuid.NullUUID{UUID: user.ID, Valid: true},
		Column2: subtreeIDs,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not inspect files in folder", err)
		return
	}

	fileIDs := make([]uuid.UUID, 0, len(filesInTree))
	for _, f := range filesInTree {
		fileIDs = append(fileIDs, f.ID)
	}
	var removedPaths []string
	if len(fileIDs) > 0 {
		removedPaths, err = qtx.DeleteFilesByIDsForOwnerPermanent(r.Context(), database.DeleteFilesByIDsForOwnerPermanentParams{
			OwnerID: uuid.NullUUID{UUID: user.ID, Valid: true},
			Column2: fileIDs,
		})
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Could not permanently delete folder files", err)
			return
		}
	}
	if err := qtx.DeleteFoldersByIDsForOwnerPermanent(r.Context(), database.DeleteFoldersByIDsForOwnerPermanentParams{
		OwnerID: user.ID,
		Column2: subtreeIDs,
	}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not permanently delete folders", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not commit permanent purge", err)
		return
	}

	for _, rawPath := range removedPaths {
		if sp, pathErr := resolveStoredFilePath(rawPath); pathErr == nil {
			_ = os.Remove(sp)
		}
	}

	cfg.insertActivity(r.Context(), user.ID, "folder_purged_permanently", map[string]interface{}{
		"folder_id":      folderID.String(),
		"name":           rootFolder.Name,
		"purged_folders": len(subtreeIDs),
		"purged_files":   len(fileIDs),
	})
	cfg.insertAudit(r.Context(), user.ID, "folder.purged_permanently", "folder", &folderID, map[string]interface{}{
		"name":           rootFolder.Name,
		"purged_folders": len(subtreeIDs),
		"purged_files":   len(fileIDs),
	}, r)

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"purged":         true,
		"id":             folderID.String(),
		"purged_folders": len(subtreeIDs),
		"purged_files":   len(fileIDs),
	})
}
