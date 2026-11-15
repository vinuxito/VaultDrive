package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

var allowedUploadCredentialSchemes = map[string]bool{
	"":         true,
	"rsa":      true,
	"folder":   true,
	"pin":      true,
	"password": true,
	"drop-pin": true,
}

func actorHasAnyScope(r *http.Request, scopes ...string) bool {
	actor, ok := actorFromContext(r.Context())
	if !ok || actor == nil {
		return false
	}
	if actor.AuthType != "agent_api_key" {
		return true
	}
	for _, s := range scopes {
		if scopeAllowed(actor.Scopes, s) {
			return true
		}
	}
	return false
}

func requireAnyActorScope(w http.ResponseWriter, r *http.Request, scopes ...string) bool {
	if actorHasAnyScope(r, scopes...) {
		return true
	}
	respondWithV1Error(w, r, http.StatusForbidden, "Insufficient API key scope for this resource")
	return false
}

func parseV1UploadMetadata(rawMetadata, schemeRaw, ivRaw, algorithmRaw, saltRaw, wrappedKey string) (string, string, error) {
	meta := map[string]any{}
	if strings.TrimSpace(rawMetadata) != "" {
		if err := json.Unmarshal([]byte(rawMetadata), &meta); err != nil {
			return "", "", fmt.Errorf("invalid metadata JSON: %w", err)
		}
	}

	scheme := strings.ToLower(strings.TrimSpace(schemeRaw))
	if scheme == "" {
		if existing, ok := meta["credential_scheme"].(string); ok {
			scheme = strings.ToLower(strings.TrimSpace(existing))
		}
	}
	if !allowedUploadCredentialSchemes[scheme] {
		return "", "", fmt.Errorf("unsupported credential_scheme %q (expected rsa, folder, pin, or password)", scheme)
	}

	if v := strings.TrimSpace(ivRaw); v != "" {
		meta["iv"] = v
	}
	if v := strings.TrimSpace(algorithmRaw); v != "" {
		meta["algorithm"] = v
	}
	if v := strings.TrimSpace(saltRaw); v != "" {
		meta["salt"] = v
	}
	if scheme != "" {
		meta["credential_scheme"] = scheme
	}

	ivVal, _ := meta["iv"].(string)
	if scheme == "rsa" || scheme == "folder" {
		if strings.TrimSpace(wrappedKey) == "" {
			return "", "", fmt.Errorf("wrapped_key is required when credential_scheme is %q", scheme)
		}
		if strings.TrimSpace(ivVal) == "" {
			return "", "", fmt.Errorf("iv is required in metadata or form field when credential_scheme is %q", scheme)
		}
		if algVal, _ := meta["algorithm"].(string); strings.TrimSpace(algVal) == "" {
			meta["algorithm"] = "AES-GCM"
		}
	} else if strings.TrimSpace(wrappedKey) != "" && strings.TrimSpace(ivVal) == "" {
		return "", "", errors.New("iv is required in metadata or form field when wrapped_key is provided")
	}

	encoded, err := json.Marshal(meta)
	if err != nil {
		return "", "", fmt.Errorf("marshal metadata: %w", err)
	}
	return string(encoded), scheme, nil
}

func extractMetadataCredentialScheme(raw sql.NullString) string {
	if !raw.Valid || strings.TrimSpace(raw.String) == "" {
		return ""
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(raw.String), &m); err != nil {
		return ""
	}
	s, _ := m["credential_scheme"].(string)
	return strings.TrimSpace(s)
}

func (cfg *ApiConfig) userCanAccessFile(ctx context.Context, dbFile database.File, userID uuid.UUID) (bool, string, string, error) {
	if dbFile.OwnerID.Valid && dbFile.OwnerID.UUID == userID {
		return true, "owner", "", nil
	}
	if share, err := cfg.dbQueries.GetShareByFileAndUser(ctx, database.GetShareByFileAndUserParams{
		FileID:           uuid.NullUUID{UUID: dbFile.ID, Valid: true},
		SharedWithUserID: uuid.NullUUID{UUID: userID, Valid: true},
	}); err == nil {
		return true, "file", share.WrappedKey, nil
	} else if !errors.Is(err, sql.ErrNoRows) {
		return false, "", "", err
	}

	if dbFile.FolderID.Valid {
		if folderShare, err := cfg.dbQueries.GetFolderShare(ctx, database.GetFolderShareParams{
			FolderID: dbFile.FolderID.UUID,
			UserID:   userID,
		}); err == nil {
			return true, "folder", folderShare.WrappedKey, nil
		} else if !errors.Is(err, sql.ErrNoRows) {
			return false, "", "", err
		}
	}
	return false, "", "", nil
}

func (cfg *ApiConfig) resolveV1FileWrappedKey(ctx context.Context, dbFile database.File, requesterID uuid.UUID, shareFallback string) string {
	if ak, err := cfg.dbQueries.GetFileAccessKey(ctx, database.GetFileAccessKeyParams{
		FileID: uuid.NullUUID{UUID: dbFile.ID, Valid: true},
		UserID: uuid.NullUUID{UUID: requesterID, Valid: true},
	}); err == nil && ak.WrappedKey != "" {
		return ak.WrappedKey
	}
	if dbFile.FolderID.Valid {
		if fak, err := cfg.dbQueries.GetFileAccessKey(ctx, database.GetFileAccessKeyParams{
			FileID: uuid.NullUUID{UUID: dbFile.ID, Valid: true},
			UserID: uuid.NullUUID{UUID: dbFile.FolderID.UUID, Valid: true},
		}); err == nil && fak.WrappedKey != "" {
			return fak.WrappedKey
		}
		if dbFile.OwnerID.Valid && extractMetadataCredentialScheme(dbFile.EncryptedMetadata) == "folder" {
			if oak, err := cfg.dbQueries.GetFileAccessKey(ctx, database.GetFileAccessKeyParams{
				FileID: uuid.NullUUID{UUID: dbFile.ID, Valid: true},
				UserID: uuid.NullUUID{UUID: dbFile.OwnerID.UUID, Valid: true},
			}); err == nil && oak.WrappedKey != "" {
				return oak.WrappedKey
			}
		}
	}
	return shareFallback
}

func (cfg *ApiConfig) handlerV1GetMyPublicKey(w http.ResponseWriter, r *http.Request, user database.User) {
	if !requireAnyActorScope(w, r, "files:upload_ciphertext", "files:read_metadata", "files:list", "shares:create", "folders:write") {
		return
	}
	dbUser, err := cfg.dbQueries.GetUserByID(r.Context(), user.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithV1Error(w, r, http.StatusNotFound, "User not found")
			return
		}
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to load user public key")
		return
	}
	if strings.TrimSpace(dbUser.PublicKey) == "" {
		respondWithV1Error(w, r, http.StatusNotFound, "Owner public key not configured")
		return
	}
	respondWithV1(w, r, http.StatusOK, map[string]any{
		"user_id":              dbUser.ID.String(),
		"email":                dbUser.Email,
		"public_key":           dbUser.PublicKey,
		"kek_envelope_version": dbUser.KekEnvelopeVersion,
	}, nil)
}

func (cfg *ApiConfig) handlerV1GetPublicKeyByID(w http.ResponseWriter, r *http.Request, _ database.User) {
	if !requireAnyActorScope(w, r, "shares:create", "files:read_metadata", "files:list") {
		return
	}
	targetID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid user ID")
		return
	}
	dbUser, err := cfg.dbQueries.GetUserByID(r.Context(), targetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithV1Error(w, r, http.StatusNotFound, "User not found")
			return
		}
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to look up public key")
		return
	}
	if strings.TrimSpace(dbUser.PublicKey) == "" {
		respondWithV1Error(w, r, http.StatusNotFound, "Public key not configured for user")
		return
	}
	respondWithV1(w, r, http.StatusOK, map[string]any{
		"user_id":    dbUser.ID.String(),
		"email":      dbUser.Email,
		"public_key": dbUser.PublicKey,
	}, nil)
}

func (cfg *ApiConfig) handlerV1ListSharedFiles(w http.ResponseWriter, r *http.Request, user database.User) {
	if !requireAnyActorScope(w, r, "files:list") {
		return
	}
	search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("search")))
	limit := 50
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		if parsed, err := strconv.Atoi(rawLimit); err == nil && parsed > 0 {
			limit = parsed
			if limit > 200 {
				limit = 200
			}
		}
	}
	offset := 0
	if rawOffset := strings.TrimSpace(r.URL.Query().Get("offset")); rawOffset != "" {
		if parsed, err := strconv.Atoi(rawOffset); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	type sharedEntry struct {
		file             database.File
		sharedVia        string
		folderWrappedKey string
		shareWrappedKey  string
	}

	seen := map[uuid.UUID]bool{}
	var entries []sharedEntry

	directFiles, err := cfg.dbQueries.GetFilesBySharedWithUser(r.Context(), uuid.NullUUID{UUID: user.ID, Valid: true})
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to list shared files")
		return
	}
	for _, f := range directFiles {
		if seen[f.ID] {
			continue
		}
		seen[f.ID] = true
		var shareKey string
		if sh, err := cfg.dbQueries.GetShareByFileAndUser(r.Context(), database.GetShareByFileAndUserParams{
			FileID:           uuid.NullUUID{UUID: f.ID, Valid: true},
			SharedWithUserID: uuid.NullUUID{UUID: user.ID, Valid: true},
		}); err == nil {
			shareKey = sh.WrappedKey
		}
		entries = append(entries, sharedEntry{
			file:            f,
			sharedVia:       "file",
			shareWrappedKey: shareKey,
		})
	}

	sharedFolders, err := cfg.dbQueries.ListFoldersSharedWithUser(r.Context(), user.ID)
	if err == nil {
		for _, sf := range sharedFolders {
			folderFiles, err := cfg.dbQueries.GetFilesByFolderID(r.Context(), uuid.NullUUID{UUID: sf.ID, Valid: true})
			if err != nil {
				continue
			}
			for _, f := range folderFiles {
				if seen[f.ID] {
					continue
				}
				seen[f.ID] = true
				entries = append(entries, sharedEntry{
					file:             f,
					sharedVia:        "folder",
					folderWrappedKey: sf.WrappedKey,
				})
			}
		}
	}

	var filtered []sharedEntry
	for _, entry := range entries {
		if search != "" && !strings.Contains(strings.ToLower(entry.file.Filename), search) {
			continue
		}
		filtered = append(filtered, entry)
	}

	total := len(filtered)
	start := offset
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}

	result := make([]map[string]any, 0, end-start)
	for _, entry := range filtered[start:end] {
		f := entry.file
		wrappedKey := cfg.resolveV1FileWrappedKey(r.Context(), f, user.ID, entry.shareWrappedKey)
		var folderIDVal any
		if f.FolderID.Valid {
			folderIDVal = f.FolderID.UUID.String()
		}
		var ownerIDVal any
		if f.OwnerID.Valid {
			ownerIDVal = f.OwnerID.UUID.String()
		}
		item := map[string]any{
			"id":                f.ID.String(),
			"filename":          f.Filename,
			"file_size":         f.FileSize,
			"created_at":        f.CreatedAt,
			"updated_at":        f.UpdatedAt,
			"folder_id":         folderIDVal,
			"owner_id":          ownerIDVal,
			"is_owner":          false,
			"shared_via":        entry.sharedVia,
			"metadata":          f.EncryptedMetadata.String,
			"credential_scheme": extractMetadataCredentialScheme(f.EncryptedMetadata),
			"wrapped_key":       wrappedKey,
		}
		if entry.folderWrappedKey != "" {
			item["folder_wrapped_key"] = entry.folderWrappedKey
		}
		result = append(result, item)
	}

	respondWithV1(w, r, http.StatusOK, result, map[string]int{
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
