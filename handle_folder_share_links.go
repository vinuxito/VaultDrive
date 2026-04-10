package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/vinuxito/VaultDrive/internal/database"
	"github.com/google/uuid"
)

// --- Response types ---

type folderShareLinkResponse struct {
	ID                    uuid.UUID  `json:"id"`
	Token                 string     `json:"token"`
	FolderID              uuid.UUID  `json:"folder_id"`
	ExpiresAt             *time.Time `json:"expires_at"`
	IsActive              bool       `json:"is_active"`
	AccessCount           int32      `json:"access_count"`
	LastAccessedAt        *time.Time `json:"last_accessed_at,omitempty"`
	OwnerWrappedFolderKey string     `json:"owner_wrapped_folder_key,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
}

type folderShareLinkRecord struct {
	ID                    uuid.UUID
	FolderID              uuid.UUID
	OwnerID               uuid.UUID
	Token                 string
	ExpiresAt             sql.NullTime
	IsActive              bool
	AccessCount           int32
	LastAccessedAt        sql.NullTime
	CreatedAt             time.Time
	OwnerWrappedFolderKey sql.NullString
}

func folderShareLinkRecordToResponse(link folderShareLinkRecord) folderShareLinkResponse {
	resp := folderShareLinkResponse{
		ID:          link.ID,
		Token:       link.Token,
		FolderID:    link.FolderID,
		IsActive:    link.IsActive,
		AccessCount: link.AccessCount,
		CreatedAt:   link.CreatedAt,
	}
	if link.ExpiresAt.Valid {
		resp.ExpiresAt = &link.ExpiresAt.Time
	}
	if link.LastAccessedAt.Valid {
		resp.LastAccessedAt = &link.LastAccessedAt.Time
	}
	if link.OwnerWrappedFolderKey.Valid {
		resp.OwnerWrappedFolderKey = link.OwnerWrappedFolderKey.String
	}
	return resp
}

func dbFolderShareLinkToResponse(link database.FolderShareLink) folderShareLinkResponse {
	return folderShareLinkRecordToResponse(folderShareLinkRecord{
		ID:             link.ID,
		FolderID:       link.FolderID,
		OwnerID:        link.OwnerID,
		Token:          link.Token,
		ExpiresAt:      link.ExpiresAt,
		IsActive:       link.IsActive,
		AccessCount:    link.AccessCount,
		LastAccessedAt: link.LastAccessedAt,
		CreatedAt:      link.CreatedAt,
	})
}

func scanFolderShareLinkRecord(scanner interface{ Scan(dest ...any) error }) (folderShareLinkRecord, error) {
	var record folderShareLinkRecord
	err := scanner.Scan(
		&record.ID,
		&record.FolderID,
		&record.OwnerID,
		&record.Token,
		&record.ExpiresAt,
		&record.IsActive,
		&record.AccessCount,
		&record.LastAccessedAt,
		&record.CreatedAt,
		&record.OwnerWrappedFolderKey,
	)
	return record, err
}

type sharedFileEntry struct {
	ID                string `json:"id"`
	Filename          string `json:"filename"`
	FileSize          int64  `json:"file_size"`
	EncryptedMetadata string `json:"encrypted_metadata"`
	FolderID          string `json:"folder_id"`
}

type sharedFolderNode struct {
	ID         string             `json:"id"`
	Name       string             `json:"name"`
	Files      []sharedFileEntry  `json:"files"`
	Subfolders []sharedFolderNode `json:"subfolders"`
}

// --- Authenticated handlers ---

func (cfg *ApiConfig) handlerCreateFolderShareLink(w http.ResponseWriter, r *http.Request, user database.User) {
	folderIDStr := r.PathValue("folderId")
	if folderIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "Folder ID is required", nil)
		return
	}

	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID format", err)
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Folder not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving folder", err)
		return
	}

	if folder.OwnerID != user.ID {
		respondWithError(w, http.StatusForbidden, "You do not own this folder", nil)
		return
	}

	var body struct {
		ExpiresAt             string            `json:"expires_at"`
		WrappedKeys           map[string]string `json:"wrapped_keys"`
		OwnerWrappedFolderKey string            `json:"owner_wrapped_folder_key"`
	}
	// Limit body to 5MB to prevent abuse (each wrapped key ~60 bytes, supports ~80K files)
	limitedBody := io.LimitReader(r.Body, 5<<20)
	if err := json.NewDecoder(limitedBody).Decode(&body); err != nil && err != io.EOF {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if len(body.WrappedKeys) == 0 {
		respondWithError(w, http.StatusBadRequest, "wrapped_keys is required and must not be empty", nil)
		return
	}
	if body.OwnerWrappedFolderKey == "" {
		respondWithError(w, http.StatusBadRequest, "owner_wrapped_folder_key is required", nil)
		return
	}

	var expiresAt sql.NullTime
	if body.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, body.ExpiresAt)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid expires_at format, use RFC3339", err)
			return
		}
		expiresAt = sql.NullTime{Time: t, Valid: true}
	} else {
		expiresAt = sql.NullTime{Time: time.Now().Add(7 * 24 * time.Hour), Valid: true}
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not generate token", err)
		return
	}
	token := hex.EncodeToString(tokenBytes)

	row := cfg.db.QueryRowContext(
		r.Context(),
		`INSERT INTO folder_share_links (folder_id, owner_id, token, expires_at, owner_wrapped_folder_key)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, folder_id, owner_id, token, expires_at, is_active, access_count, last_accessed_at, created_at, owner_wrapped_folder_key`,
		folderID,
		user.ID,
		token,
		expiresAt,
		body.OwnerWrappedFolderKey,
	)
	link, err := scanFolderShareLinkRecord(row)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not create folder share link", err)
		return
	}

	// Validate file IDs belong to the folder subtree
	subtreeIDs, err := cfg.dbQueries.GetFolderSubtreeIDs(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error validating folder subtree", err)
		return
	}
	subtreeFiles, err := cfg.dbQueries.GetFilesByFolderIDs(r.Context(), subtreeIDs)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error validating files", err)
		return
	}
	validFileIDs := make(map[string]bool, len(subtreeFiles))
	for _, f := range subtreeFiles {
		validFileIDs[f.ID.String()] = true
	}

	insertedCount := 0
	for fileIDStr, wrappedKey := range body.WrappedKeys {
		if !validFileIDs[fileIDStr] {
			continue // skip file IDs not in the folder subtree
		}
		fileID, parseErr := uuid.Parse(fileIDStr)
		if parseErr != nil {
			continue
		}
		_ = cfg.dbQueries.CreateFolderShareFileKey(r.Context(), database.CreateFolderShareFileKeyParams{
			FolderShareLinkID: link.ID,
			FileID:            fileID,
			WrappedFileKey:    wrappedKey,
		})
		insertedCount++
	}

	cfg.insertActivity(r.Context(), user.ID, "folder_share_link_created", map[string]interface{}{
		"folder_id":     folderID.String(),
		"folder_name":   folder.Name,
		"share_link_id": link.ID.String(),
		"file_count":    insertedCount,
	})
	cfg.insertAudit(r.Context(), user.ID, "folder_share_link.created", "folder_share_link", &link.ID, map[string]interface{}{
		"folder_id":   folderID.String(),
		"folder_name": folder.Name,
		"file_count":  insertedCount,
	}, r)

	respondWithJSON(w, http.StatusCreated, folderShareLinkRecordToResponse(link))
}

func (cfg *ApiConfig) handlerListFolderShareLinks(w http.ResponseWriter, r *http.Request, user database.User) {
	folderIDStr := r.PathValue("folderId")
	if folderIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "Folder ID is required", nil)
		return
	}

	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID format", err)
		return
	}

	rows, err := cfg.db.QueryContext(
		r.Context(),
		`SELECT id, folder_id, owner_id, token, expires_at, is_active, access_count, last_accessed_at, created_at, owner_wrapped_folder_key
		 FROM folder_share_links
		 WHERE folder_id = $1 AND owner_id = $2
		 ORDER BY created_at DESC`,
		folderID,
		user.ID,
	)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error retrieving folder share links", err)
		return
	}
	defer rows.Close()

	result := make([]folderShareLinkResponse, 0)
	for rows.Next() {
		link, scanErr := scanFolderShareLinkRecord(rows)
		if scanErr != nil {
			respondWithError(w, http.StatusInternalServerError, "Error reading folder share links", scanErr)
			return
		}
		result = append(result, folderShareLinkRecordToResponse(link))
	}
	if err := rows.Err(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error reading folder share links", err)
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (cfg *ApiConfig) handlerListOwnedFolderShareLinks(w http.ResponseWriter, r *http.Request, user database.User) {
	rows, err := cfg.db.QueryContext(
		r.Context(),
		`SELECT id, folder_id, owner_id, token, expires_at, is_active, access_count, last_accessed_at, created_at, owner_wrapped_folder_key
		 FROM folder_share_links
		 WHERE owner_id = $1 AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
		 ORDER BY created_at DESC`,
		user.ID,
	)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error retrieving owned folder share links", err)
		return
	}
	defer rows.Close()

	result := make([]folderShareLinkResponse, 0)
	for rows.Next() {
		link, scanErr := scanFolderShareLinkRecord(rows)
		if scanErr != nil {
			respondWithError(w, http.StatusInternalServerError, "Error reading owned folder share links", scanErr)
			return
		}
		result = append(result, folderShareLinkRecordToResponse(link))
	}
	if err := rows.Err(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error reading owned folder share links", err)
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (cfg *ApiConfig) handlerRevokeFolderShareLink(w http.ResponseWriter, r *http.Request, user database.User) {
	linkIDStr := r.PathValue("linkId")
	if linkIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "Link ID is required", nil)
		return
	}

	linkID, err := uuid.Parse(linkIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid link ID format", err)
		return
	}

	err = cfg.dbQueries.RevokeFolderShareLink(r.Context(), database.RevokeFolderShareLinkParams{
		ID:      linkID,
		OwnerID: user.ID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error revoking folder share link", err)
		return
	}

	cfg.insertActivity(r.Context(), user.ID, "folder_share_link_revoked", map[string]interface{}{
		"share_link_id": linkID.String(),
	})
	cfg.insertAudit(r.Context(), user.ID, "folder_share_link.revoked", "folder_share_link", &linkID, nil, r)

	respondWithJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "Folder share link revoked",
	})
}

func (cfg *ApiConfig) handlerSyncFolderShareLink(w http.ResponseWriter, r *http.Request, user database.User) {
	linkIDStr := r.PathValue("linkId")
	if linkIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "Link ID is required", nil)
		return
	}

	linkID, err := uuid.Parse(linkIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid link ID format", err)
		return
	}

	row := cfg.db.QueryRowContext(
		r.Context(),
		`SELECT id, folder_id, owner_id, token, expires_at, is_active, access_count, last_accessed_at, created_at, owner_wrapped_folder_key
		 FROM folder_share_links
		 WHERE id = $1 AND owner_id = $2`,
		linkID,
		user.ID,
	)
	link, err := scanFolderShareLinkRecord(row)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Folder share link not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving folder share link", err)
		return
	}

	if !link.IsActive {
		respondWithError(w, http.StatusBadRequest, "Folder share link is not active", nil)
		return
	}
	if link.ExpiresAt.Valid && link.ExpiresAt.Time.Before(time.Now()) {
		respondWithError(w, http.StatusBadRequest, "Folder share link has expired", nil)
		return
	}

	var body struct {
		WrappedKeys           map[string]string `json:"wrapped_keys"`
		OwnerWrappedFolderKey string            `json:"owner_wrapped_folder_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}
	if body.OwnerWrappedFolderKey != "" && !link.OwnerWrappedFolderKey.Valid {
		_, err = cfg.db.ExecContext(
			r.Context(),
			`UPDATE folder_share_links SET owner_wrapped_folder_key = $1 WHERE id = $2 AND owner_id = $3 AND owner_wrapped_folder_key IS NULL`,
			body.OwnerWrappedFolderKey,
			link.ID,
			user.ID,
		)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Error upgrading folder share link", err)
			return
		}
	}

	if len(body.WrappedKeys) == 0 {
		respondWithJSON(w, http.StatusOK, map[string]int{"synced": 0, "skipped": 0})
		return
	}

	subtreeIDs, err := cfg.dbQueries.GetFolderSubtreeIDs(r.Context(), link.FolderID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error validating folder subtree", err)
		return
	}
	subtreeFiles, err := cfg.dbQueries.GetFilesByFolderIDs(r.Context(), subtreeIDs)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error validating files", err)
		return
	}
	validFileIDs := make(map[string]bool, len(subtreeFiles))
	for _, file := range subtreeFiles {
		validFileIDs[file.ID.String()] = true
	}

	synced := 0
	skipped := 0
	for fileIDStr, wrappedKey := range body.WrappedKeys {
		if !validFileIDs[fileIDStr] {
			skipped++
			continue
		}
		fileID, parseErr := uuid.Parse(fileIDStr)
		if parseErr != nil {
			skipped++
			continue
		}

		result, execErr := cfg.db.ExecContext(
			r.Context(),
			`INSERT INTO folder_share_file_keys (folder_share_link_id, file_id, wrapped_file_key)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (folder_share_link_id, file_id)
			 DO UPDATE SET wrapped_file_key = EXCLUDED.wrapped_file_key`,
			link.ID,
			fileID,
			wrappedKey,
		)
		if execErr != nil {
			skipped++
			continue
		}
		if rowsAffected, _ := result.RowsAffected(); rowsAffected > 0 {
			synced++
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]int{
		"synced":  synced,
		"skipped": skipped,
	})
}

// handlerGetFolderFilesRecursive returns all files in a folder subtree (authenticated, owner-only)
func (cfg *ApiConfig) handlerGetFolderFilesRecursive(w http.ResponseWriter, r *http.Request, user database.User) {
	folderIDStr := r.PathValue("folderId")
	if folderIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "Folder ID is required", nil)
		return
	}

	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID format", err)
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder not found", err)
		return
	}
	if folder.OwnerID != user.ID {
		respondWithError(w, http.StatusForbidden, "You do not own this folder", nil)
		return
	}

	subtreeIDs, err := cfg.dbQueries.GetFolderSubtreeIDs(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error getting folder subtree", err)
		return
	}

	files, err := cfg.dbQueries.GetFilesByFolderIDs(r.Context(), subtreeIDs)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error getting files", err)
		return
	}

	type fileResp struct {
		ID                string `json:"id"`
		Filename          string `json:"filename"`
		FileSize          int64  `json:"file_size"`
		FolderID          string `json:"folder_id"`
		EncryptedMetadata string `json:"encrypted_metadata"`
	}

	result := make([]fileResp, 0, len(files))
	for _, f := range files {
		fid := ""
		if f.FolderID.Valid {
			fid = f.FolderID.UUID.String()
		}
		meta := ""
		if f.EncryptedMetadata.Valid {
			meta = f.EncryptedMetadata.String
		}
		result = append(result, fileResp{
			ID:                f.ID.String(),
			Filename:          f.Filename,
			FileSize:          f.FileSize,
			FolderID:          fid,
			EncryptedMetadata: meta,
		})
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"files":       result,
		"total_count": len(result),
	})
}

// handlerGetBatchAccessKeys returns wrapped keys for multiple files (authenticated)
func (cfg *ApiConfig) handlerGetBatchAccessKeys(w http.ResponseWriter, r *http.Request, user database.User) {
	var body struct {
		FileIDs []string `json:"file_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	result := make(map[string]string, len(body.FileIDs))
	for _, idStr := range body.FileIDs {
		fileID, parseErr := uuid.Parse(idStr)
		if parseErr != nil {
			continue
		}
		accessKey, err := cfg.dbQueries.GetFileAccessKey(r.Context(), database.GetFileAccessKeyParams{
			FileID: uuid.NullUUID{UUID: fileID, Valid: true},
			UserID: uuid.NullUUID{UUID: user.ID, Valid: true},
		})
		if err != nil {
			continue
		}
		result[idStr] = accessKey.WrappedKey
	}

	respondWithJSON(w, http.StatusOK, result)
}

// --- Public handlers (no auth) ---

func (cfg *ApiConfig) handlerGetFolderShareInfo(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		respondWithError(w, http.StatusBadRequest, "Token is required", nil)
		return
	}

	link, err := cfg.dbQueries.GetFolderShareLinkByToken(r.Context(), token)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder share link not found or inactive", nil)
		return
	}

	if link.ExpiresAt.Valid && link.ExpiresAt.Time.Before(time.Now()) {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"is_expired": true,
			"expires_at": link.ExpiresAt.Time.UTC().Format(time.RFC3339),
		})
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), link.FolderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder not found", nil)
		return
	}

	subtreeIDs, err := cfg.dbQueries.GetFolderSubtreeIDs(r.Context(), link.FolderID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error building folder tree", err)
		return
	}

	// Get all folders in subtree
	allFolders := make(map[string]database.Folder)
	for _, fid := range subtreeIDs {
		f, ferr := cfg.dbQueries.GetFolderByID(r.Context(), fid)
		if ferr == nil {
			allFolders[fid.String()] = f
		}
	}

	// Get all files with wrapped keys for this share
	fileKeys, err := cfg.dbQueries.GetFolderShareFileKeys(r.Context(), link.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error getting file keys", err)
		return
	}

	fileIDSet := make(map[uuid.UUID]bool, len(fileKeys))
	for _, fk := range fileKeys {
		fileIDSet[fk.FileID] = true
	}

	// Load files by folder
	filesByFolder := make(map[string][]sharedFileEntry)
	var totalFiles int
	var totalSize int64

	files, ferr := cfg.dbQueries.GetFilesByFolderIDs(r.Context(), subtreeIDs)
	if ferr == nil {
		for _, f := range files {
			if !fileIDSet[f.ID] {
				continue
			}
			fid := ""
			if f.FolderID.Valid {
				fid = f.FolderID.UUID.String()
			}
			meta := ""
			if f.EncryptedMetadata.Valid {
				meta = f.EncryptedMetadata.String
			}
			entry := sharedFileEntry{
				ID:                f.ID.String(),
				Filename:          f.Filename,
				FileSize:          f.FileSize,
				EncryptedMetadata: meta,
				FolderID:          fid,
			}
			filesByFolder[fid] = append(filesByFolder[fid], entry)
			totalFiles++
			totalSize += f.FileSize
		}
	}

	// Build tree recursively
	var buildTree func(folderID string) sharedFolderNode
	buildTree = func(folderID string) sharedFolderNode {
		f := allFolders[folderID]
		node := sharedFolderNode{
			ID:         folderID,
			Name:       f.Name,
			Files:      filesByFolder[folderID],
			Subfolders: []sharedFolderNode{},
		}
		if node.Files == nil {
			node.Files = []sharedFileEntry{}
		}
		for sid, sf := range allFolders {
			if sf.ParentID.Valid && sf.ParentID.UUID.String() == folderID {
				node.Subfolders = append(node.Subfolders, buildTree(sid))
			}
		}
		sort.Slice(node.Subfolders, func(i, j int) bool {
			return node.Subfolders[i].Name < node.Subfolders[j].Name
		})
		return node
	}

	tree := buildTree(folder.ID.String())

	ownerDisplayName := ""
	ownerOrg := ""
	cfg.db.QueryRowContext(r.Context(),
		`SELECT COALESCE(first_name||' '||last_name,''), COALESCE(organization_name,'') FROM users WHERE id = $1`,
		link.OwnerID,
	).Scan(&ownerDisplayName, &ownerOrg)

	var expiresAt *string
	if link.ExpiresAt.Valid {
		s := link.ExpiresAt.Time.UTC().Format(time.RFC3339)
		expiresAt = &s
	}

	_ = cfg.dbQueries.IncrementFolderShareLinkAccess(r.Context(), token)

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"folder_name":        folder.Name,
		"owner_display_name": ownerDisplayName,
		"owner_organization": ownerOrg,
		"expires_at":         expiresAt,
		"is_expired":         false,
		"access_count":       link.AccessCount,
		"tree":               tree,
		"total_files":        totalFiles,
		"total_size":         totalSize,
	})
}

func (cfg *ApiConfig) handlerGetFolderShareKeys(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		respondWithError(w, http.StatusBadRequest, "Token is required", nil)
		return
	}

	link, err := cfg.dbQueries.GetFolderShareLinkByToken(r.Context(), token)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder share link not found or inactive", nil)
		return
	}

	if link.ExpiresAt.Valid && link.ExpiresAt.Time.Before(time.Now()) {
		respondWithError(w, http.StatusForbidden, "Folder share link has expired", nil)
		return
	}

	fileKeys, err := cfg.dbQueries.GetFolderShareFileKeys(r.Context(), link.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error getting file keys", err)
		return
	}

	result := make(map[string]string, len(fileKeys))
	for _, fk := range fileKeys {
		result[fk.FileID.String()] = fk.WrappedFileKey
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (cfg *ApiConfig) handlerGetFolderShareFile(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	fileIDStr := r.PathValue("fileId")
	if token == "" || fileIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "Token and file ID are required", nil)
		return
	}

	link, err := cfg.dbQueries.GetFolderShareLinkByToken(r.Context(), token)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder share link not found or inactive", nil)
		return
	}

	if link.ExpiresAt.Valid && link.ExpiresAt.Time.Before(time.Now()) {
		respondWithError(w, http.StatusForbidden, "Folder share link has expired", nil)
		return
	}

	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID format", err)
		return
	}

	// Verify this file is part of the share
	_, err = cfg.dbQueries.GetFolderShareFileKeyByFile(r.Context(), database.GetFolderShareFileKeyByFileParams{
		FolderShareLinkID: link.ID,
		FileID:            fileID,
	})
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File not found in this shared folder", nil)
		return
	}

	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File not found", nil)
		return
	}

	file, err := os.Open(dbFile.FilePath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not read file from disk", err)
		return
	}
	defer file.Close()

	w.Header().Set("X-File-Name", dbFile.Filename)
	w.Header().Set("Content-Type", "application/octet-stream")
	if dbFile.EncryptedMetadata.Valid {
		w.Header().Set("X-File-Metadata", dbFile.EncryptedMetadata.String)
	}

	io.Copy(w, file)
}
