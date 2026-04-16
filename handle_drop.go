package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func (cfg *ApiConfig) handlerDropTokenInfo(w http.ResponseWriter, r *http.Request) {
	// Extract token from URL path
	pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/drop/"), "/")
	tokenStr := ""
	if len(pathParts) > 0 {
		tokenStr = pathParts[0]
	}

	if tokenStr == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No token provided"})
		return
	}

	uploadToken, err := cfg.dbQueries.GetUploadTokenByToken(r.Context(), tokenStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid or expired upload token"})
		return
	}

	if uploadToken.Used.Valid && uploadToken.Used.Bool {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "This upload link has already been used"})
		return
	}

	if uploadToken.ExpiresAt.Valid && uploadToken.ExpiresAt.Time.Before(time.Now()) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "Upload token has expired"})
		return
	}

	if uploadToken.MaxFiles.Valid && uploadToken.MaxFiles.Int32 > 0 && uploadToken.FilesUploaded.Valid {
		if uploadToken.FilesUploaded.Int32 >= uploadToken.MaxFiles.Int32 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "Maximum file limit reached"})
			return
		}
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), uploadToken.TargetFolderID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error getting folder info"})
		return
	}

	owner, err := cfg.dbQueries.GetUserByID(r.Context(), uploadToken.OwnerUserID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error getting owner info"})
		return
	}

	ownerDisplayName := strings.TrimSpace(owner.FirstName + " " + owner.LastName)
	if ownerDisplayName == "" {
		ownerDisplayName = owner.Username
	}
	ownerOrg := ""
	cfg.db.QueryRowContext(r.Context(),
		"SELECT COALESCE(organization_name, '') FROM users WHERE id = $1", uploadToken.OwnerUserID,
	).Scan(&ownerOrg)

	filesLimit := ""
	if uploadToken.MaxFiles.Valid {
		filesLimit = fmt.Sprintf("%d", uploadToken.MaxFiles.Int32)
	}

	uploaded := "0"
	if uploadToken.FilesUploaded.Valid {
		uploaded = fmt.Sprintf("%d", uploadToken.FilesUploaded.Int32)
	}

	expiresAt := ""
	if uploadToken.ExpiresAt.Valid {
		expiresAt = uploadToken.ExpiresAt.Time.Format(time.RFC3339)
	}

	// Fetch checklist_items from the new column (added in migration 043).
	var checklistItems json.RawMessage
	if err := cfg.db.QueryRowContext(r.Context(),
		`SELECT COALESCE(checklist_items, '[]'::jsonb) FROM upload_tokens WHERE token = $1`, tokenStr,
	).Scan(&checklistItems); err != nil {
		checklistItems = json.RawMessage("[]")
	}

	response := map[string]interface{}{
		"valid":              true,
		"folder_name":        folder.Name,
		"link_name":          uploadToken.LinkName.String,
		"description":        uploadToken.Description.String,
		"files_limit":        filesLimit,
		"uploaded":           uploaded,
		"expires_at":         expiresAt,
		"owner_display_name": ownerDisplayName,
		"owner_organization": ownerOrg,
		"checklist_items":    checklistItems,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func (cfg *ApiConfig) handlerDropUpload(w http.ResponseWriter, r *http.Request) {
	// Extract token from URL path - use same method as GET handler
	// Remove /upload from end first, then extract token
	urlPath := strings.TrimSuffix(r.URL.Path, "/")
	// Remove /upload suffix
	urlPath = strings.TrimSuffix(urlPath, "/upload")
	// Now extract token like GET handler does
	pathParts := strings.Split(strings.TrimPrefix(urlPath, "/api/drop/"), "/")
	tokenStr := ""
	if len(pathParts) > 0 {
		tokenStr = pathParts[0]
	}

	if tokenStr == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No token provided"})
		return
	}

	uploadToken, err := cfg.dbQueries.GetUploadTokenByToken(r.Context(), tokenStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid or expired upload token"})
		return
	}

	if uploadToken.Used.Valid && uploadToken.Used.Bool {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "This upload link has already been used"})
		return
	}

	if uploadToken.ExpiresAt.Valid && uploadToken.ExpiresAt.Time.Before(time.Now()) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "Upload token has expired"})
		return
	}

	if uploadToken.MaxFiles.Valid && uploadToken.MaxFiles.Int32 > 0 {
		if uploadToken.FilesUploaded.Valid && uploadToken.FilesUploaded.Int32 >= uploadToken.MaxFiles.Int32 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "Maximum file limit reached"})
			return
		}
	}

	// Parse multipart form with memory limit for large files (512MB in memory)
	var fileHeaders []*multipart.FileHeader

	if err := r.ParseMultipartForm(512 << 20); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid form data"})
		return
	}

	// Get files from form - check for multiple files first
	multipleFiles := r.MultipartForm.File["files[]"]
	if multipleFiles != nil && len(multipleFiles) > 0 {
		// Multiple files case - use the files directly
		fileHeaders = multipleFiles
	} else {
		// Single file case - use original FormFile approach
		_, handler, err := r.FormFile("file")
		if err != nil && handler != nil {
			fileHeaders = append(fileHeaders, handler)
		}
	}

	if len(fileHeaders) == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No files provided"})
		return
	}

	clientMessage := r.FormValue("client_message")

	if uploadToken.PinWrappedKey.String == "" {
		providedPassword := r.FormValue("password")
		if providedPassword == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Password is required"})
			return
		}

		storedWrappedKey := uploadToken.PasswordHash.String
		providedWrappedKey := r.FormValue("wrapped_key")
		if storedWrappedKey != "" && providedWrappedKey != storedWrappedKey {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid encryption key"})
			return
		}
	}

	uploadDir := uploadStorageDir()
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		err = os.Mkdir(uploadDir, 0755)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Could not create uploads directory"})
			return
		}
	}

	// Process each file
	type FileResult struct {
		FileName string    `json:"file_name"`
		FileID   uuid.UUID `json:"file_id"`
		Path     string    `json:"path"`
		Error    string    `json:"error,omitempty"`
	}

	var results []FileResult
	createdFiles := 0
	explicitRelativePath := ""
	if relativePaths := r.MultipartForm.Value["relative_path"]; len(relativePaths) > 0 {
		explicitRelativePath = relativePaths[0]
	}

	for _, handler := range fileHeaders {
		originalPath, safeFilename, relativeDir, err := resolveUploadRelativePath(explicitRelativePath, handler.Filename)
		if err != nil {
			log.Printf("Rejected invalid upload path %q: %v", handler.Filename, err)
			results = append(results, FileResult{FileName: handler.Filename, Error: "Invalid file path"})
			continue
		}

		// Generate unique filename with UUID
		fileUUID := uuid.New().String()
		ext := filepath.Ext(safeFilename)
		storedFilename := fileUUID + ext

		// Create nested directory structure if needed
		var storagePath string
		if relativeDir != "" {
			targetDir := filepath.Join(uploadDir, filepath.FromSlash(relativeDir))
			if err := os.MkdirAll(targetDir, 0755); err != nil {
				log.Printf("Failed to create directory %s: %v", targetDir, err)
				results = append(results, FileResult{
					FileName: originalPath,
					Error:    fmt.Sprintf("Failed to create directory: %v", err),
				})
				continue
			}
			storagePath = filepath.Join(targetDir, storedFilename)
		} else {
			storagePath = filepath.Join(uploadDir, storedFilename)
		}

		// Open uploaded file
		file, err := handler.Open()
		if err != nil {
			log.Printf("Failed to open uploaded file %s: %v", originalPath, err)
			results = append(results, FileResult{
				FileName: originalPath,
				Error:    fmt.Sprintf("Failed to open file: %v", err),
			})
			continue
		}

		// Save to disk
		dst, err := os.Create(storagePath)
		if err != nil {
			file.Close()
			log.Printf("Failed to create file %s: %v", storagePath, err)
			results = append(results, FileResult{
				FileName: originalPath,
				Error:    fmt.Sprintf("Failed to create file on server: %v", err),
			})
			continue
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			file.Close()
			dst.Close()
			os.Remove(storagePath)
			log.Printf("Failed to save file %s: %v", storagePath, err)
			results = append(results, FileResult{
				FileName: originalPath,
				Error:    fmt.Sprintf("Failed to save file: %v", err),
			})
			continue
		}
		file.Close()

		// Create file metadata
		metadata := map[string]string{
			"iv":        r.FormValue("iv"),
			"salt":      r.FormValue("salt"),
			"algorithm": r.FormValue("algorithm"),
		}

		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			os.Remove(storagePath)
			log.Printf("Failed to marshal metadata for %s: %v", originalPath, err)
			results = append(results, FileResult{
				FileName: originalPath,
				Error:    "Error processing metadata",
			})
			continue
		}

		// Create database entry
		folderID, err := ensureUploadFolderPath(cfg.dbQueries, r.Context(), uploadToken.OwnerUserID, uuid.NullUUID{UUID: uploadToken.TargetFolderID, Valid: true}, relativeDir)
		if err != nil {
			os.Remove(storagePath)
			log.Printf("Failed to ensure folder path %s: %v", relativeDir, err)
			results = append(results, FileResult{FileName: originalPath, Error: "Could not create folder structure"})
			continue
		}

		dbfile, err := cfg.dbQueries.CreateFile(r.Context(), database.CreateFileParams{
			OwnerID:           uuid.NullUUID{UUID: uploadToken.OwnerUserID, Valid: true},
			Filename:          safeFilename,
			FilePath:          storagePath,
			FileSize:          handler.Size,
			EncryptedMetadata: sql.NullString{String: string(metadataJSON), Valid: true},
			CurrentKeyVersion: sql.NullInt32{Int32: 1, Valid: true},
			CreatedAt:         time.Now().UTC(),
			UpdatedAt:         time.Now().UTC(),
			DropSourceID:      uuid.NullUUID{UUID: uploadToken.ID, Valid: true},
			FolderID:          folderID,
		})

		if err != nil {
			os.Remove(storagePath)
			cfg.dbQueries.DeleteFile(r.Context(), dbfile.ID)
			log.Printf("Failed to create file entry for %s: %v", originalPath, err)
			results = append(results, FileResult{
				FileName: originalPath,
				Error:    "Could not create file entry",
			})
			continue
		}

		accessKey := uploadToken.PinWrappedKey.String
		if accessKey == "" {
			accessKey = r.FormValue("wrapped_key")
		}
		_, err = cfg.dbQueries.CreateFileAccessKey(r.Context(), database.CreateFileAccessKeyParams{
			FileID:     uuid.NullUUID{UUID: dbfile.ID, Valid: true},
			UserID:     uuid.NullUUID{UUID: uploadToken.OwnerUserID, Valid: true},
			WrappedKey: accessKey,
		})

		if err != nil {
			os.Remove(storagePath)
			cfg.dbQueries.DeleteFile(r.Context(), dbfile.ID)
			log.Printf("Failed to create file access key for %s: %v", originalPath, err)
			results = append(results, FileResult{
				FileName: originalPath,
				Error:    "Could not save file access key",
			})
			continue
		}

		createdFiles++
		broadcastToUser(uploadToken.OwnerUserID, "drop_upload", map[string]interface{}{
			"filename": originalPath,
			"token":    tokenStr,
		})
		results = append(results, FileResult{
			FileName: originalPath,
			FileID:   dbfile.ID,
			Path:     relativeDir,
		})
	}

	if createdFiles > 0 {
		_, err = cfg.dbQueries.IncrementTokenFileCount(r.Context(), uploadToken.ID)
		if err != nil {
			log.Printf("Failed to update token file count: %v", err)
		}
		cfg.db.ExecContext(r.Context(),
			"UPDATE upload_tokens SET last_used_at = NOW() WHERE id = $1", uploadToken.ID)

		sealAfter := false
		cfg.db.QueryRowContext(r.Context(),
			"SELECT COALESCE(seal_after_upload, false) FROM upload_tokens WHERE id = $1", uploadToken.ID,
		).Scan(&sealAfter)
		if sealAfter {
			cfg.dbQueries.ExpireToken(r.Context(), uploadToken.ID)
		}
		if clientMessage != "" {
			if err := cfg.dbQueries.SaveDropClientMessage(r.Context(), database.SaveDropClientMessageParams{
				Token:         tokenStr,
				ClientMessage: sql.NullString{String: clientMessage, Valid: true},
			}); err != nil {
				log.Printf("Failed to save client message: %v", err)
			}
		}
		cfg.insertAudit(r.Context(), uploadToken.OwnerUserID, "secure_drop.uploaded", "upload_token", &uploadToken.ID, map[string]interface{}{
			"uploaded_count": createdFiles,
			"token":          tokenStr,
		}, r)
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"success":  true,
		"files":    results,
		"count":    len(results),
		"uploaded": createdFiles,
	})
}
func (cfg *ApiConfig) handlerDropDone(w http.ResponseWriter, r *http.Request) {
	// Extract token from URL path
	urlPath := strings.TrimSuffix(r.URL.Path, "/")
	urlPath = strings.TrimSuffix(urlPath, "/done")
	pathParts := strings.Split(strings.TrimPrefix(urlPath, "/api/drop/"), "/")
	tokenStr := ""
	if len(pathParts) > 0 {
		tokenStr = pathParts[0]
	}

	if tokenStr == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No token provided"})
		return
	}

	uploadToken, err := cfg.dbQueries.GetUploadTokenByToken(r.Context(), tokenStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid upload token"})
		return
	}

	_, err = cfg.dbQueries.ExpireToken(r.Context(), uploadToken.ID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error expiring token"})
		return
	}
	cfg.insertActivity(r.Context(), uploadToken.OwnerUserID, "secure_drop_revoked", map[string]interface{}{
		"upload_token_id": uploadToken.ID.String(),
		"token":           tokenStr,
	})
	cfg.insertAudit(r.Context(), uploadToken.OwnerUserID, "secure_drop.revoked", "upload_token", &uploadToken.ID, map[string]interface{}{
		"token": tokenStr,
	}, r)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Upload link has been deactivated",
	})
}

func (cfg *ApiConfig) handlerDropOwnerInfo(w http.ResponseWriter, r *http.Request) {
	// Extract token from URL path
	urlPath := strings.TrimSuffix(r.URL.Path, "/")
	urlPath = strings.TrimSuffix(urlPath, "/owner-info")
	pathParts := strings.Split(strings.TrimPrefix(urlPath, "/api/drop/"), "/")
	tokenStr := ""
	if len(pathParts) > 0 {
		tokenStr = pathParts[0]
	}

	if tokenStr == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No token provided"})
		return
	}

	uploadToken, err := cfg.dbQueries.GetUploadTokenByToken(r.Context(), tokenStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid upload token"})
		return
	}

	owner, err := cfg.dbQueries.GetUserByID(r.Context(), uploadToken.OwnerUserID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error getting owner info"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"public_key": owner.PublicKey,
	})
}

func (cfg *ApiConfig) handlerCreateDropToken(w http.ResponseWriter, r *http.Request) {
	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing or invalid token"})
		return
	}

	ownerID, err := auth.ValidateJWT(token, cfg.jwtSecret)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid token"})
		return
	}

	var req struct {
		TargetFolderID  string `json:"target_folder_id"`
		ExpiresAt       string `json:"expires_at"`
		MaxFiles        int    `json:"max_files"`
		Pin             string `json:"pin"`
		LinkName        string `json:"link_name"`
		Description     string `json:"description"`
		SealAfterUpload bool   `json:"seal_after_upload"`
	}

	err = json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}

	if req.TargetFolderID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "target_folder_id is required"})
		return
	}

	folderID, err := uuid.Parse(req.TargetFolderID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid folder ID"})
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Folder not found"})
		return
	}

	if folder.OwnerID != ownerID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "You must own this folder"})
		return
	}

	dropToken, err := generateDropToken()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not generate token"})
		return
	}

	expiresAt := sql.NullTime{}
	if req.ExpiresAt != "" {
		expTime, err := time.Parse(time.RFC3339, req.ExpiresAt)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid expires_at format (use RFC3339)"})
			return
		}
		expiresAt = sql.NullTime{Time: expTime, Valid: true}
	}

	maxFiles := sql.NullInt32{}
	if req.MaxFiles > 0 {
		maxFiles = sql.NullInt32{Int32: int32(req.MaxFiles), Valid: true}
	}

	if req.Pin == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "pin is required"})
		return
	}

	owner, err := cfg.dbQueries.GetUserByID(r.Context(), ownerID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not load user"})
		return
	}
	if !owner.PinHash.Valid || owner.PinHash.String == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Set your 4-digit PIN in Settings before creating drop links"})
		return
	}

	var lockedUntil *time.Time
	var failedAttempts int
	cfg.db.QueryRowContext(r.Context(),
		"SELECT pin_failed_attempts, pin_locked_until FROM users WHERE id = $1", ownerID,
	).Scan(&failedAttempts, &lockedUntil)
	if lockedUntil != nil && lockedUntil.After(time.Now()) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(map[string]string{"error": "Too many incorrect PIN attempts. Try again after " + lockedUntil.UTC().Format(time.RFC3339)})
		return
	}

	if err := auth.CheckPasswordHash(req.Pin, owner.PinHash.String); err != nil {
		newAttempts := failedAttempts + 1
		if newAttempts >= 5 {
			cfg.db.ExecContext(r.Context(),
				"UPDATE users SET pin_failed_attempts = $1, pin_locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2",
				newAttempts, ownerID)
		} else {
			cfg.db.ExecContext(r.Context(),
				"UPDATE users SET pin_failed_attempts = $1 WHERE id = $2",
				newAttempts, ownerID)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Incorrect PIN"})
		return
	}
	cfg.db.ExecContext(r.Context(),
		"UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1", ownerID)

	randomKeyBytes := make([]byte, 32)
	_, err = rand.Read(randomKeyBytes)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not generate encryption key"})
		return
	}
	randomKey := hex.EncodeToString(randomKeyBytes)

	pinWrappedKey, err := auth.WrapKey(req.Pin, randomKey)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not wrap key with PIN"})
		return
	}

	uploadToken, err := cfg.dbQueries.CreateUploadToken(r.Context(), database.CreateUploadTokenParams{
		Token:          dropToken,
		OwnerUserID:    ownerID,
		TargetFolderID: folderID,
		ExpiresAt:      expiresAt,
		MaxFiles:       maxFiles,
		PasswordHash:   sql.NullString{Valid: false},
		LinkName:       sql.NullString{String: req.LinkName, Valid: req.LinkName != ""},
		PinWrappedKey:  sql.NullString{String: pinWrappedKey, Valid: true},
		Description:    sql.NullString{String: req.Description, Valid: req.Description != ""},
	})

	if err != nil {
		log.Printf("Error creating upload token: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not create upload token"})
		return
	}

	if req.SealAfterUpload {
		cfg.db.ExecContext(r.Context(),
			"UPDATE upload_tokens SET seal_after_upload = TRUE WHERE id = $1", uploadToken.ID)
	}
	cfg.insertActivity(r.Context(), ownerID, "secure_drop_created", map[string]interface{}{
		"upload_token_id": uploadToken.ID.String(),
		"link_name":       req.LinkName,
	})
	cfg.insertAudit(r.Context(), ownerID, "secure_drop.created", "upload_token", &uploadToken.ID, map[string]interface{}{
		"link_name": req.LinkName,
	}, r)

	uploadURL := fmt.Sprintf("%sdrop/%s#key=%s", cfg.Product.BasePath, dropToken, randomKey)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                uploadToken.ID,
		"token":             dropToken,
		"target_folder_id":  uploadToken.TargetFolderID,
		"expires_at":        uploadToken.ExpiresAt,
		"max_files":         uploadToken.MaxFiles,
		"upload_url":        uploadURL,
		"pin_protected":     true,
		"seal_after_upload": req.SealAfterUpload,
	})
}

func (cfg *ApiConfig) handlerListDropTokens(w http.ResponseWriter, r *http.Request) {
	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing or invalid token"})
		return
	}

	ownerID, err := auth.ValidateJWT(token, cfg.jwtSecret)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid token"})
		return
	}

	tokens, err := cfg.dbQueries.ListUploadTokensByOwner(r.Context(), ownerID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not list tokens"})
		return
	}

	// Fetch last upload timestamp per token in a single query.
	lastUploadAt := map[string]time.Time{}
	if rows, err := cfg.db.QueryContext(r.Context(),
		`SELECT u.id::text, MAX(f.created_at) AS last_upload_at
		 FROM files f
		 INNER JOIN upload_tokens u ON f.drop_source_id = u.id
		 WHERE u.owner_user_id = $1
		 GROUP BY u.id`, ownerID); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id string
			var ts time.Time
			if rows.Scan(&id, &ts) == nil {
				lastUploadAt[id] = ts
			}
		}
	}

	// Build response with upload URLs and intake analytics.
	type TokenResponse struct {
		ID             string     `json:"id"`
		Token          string     `json:"token"`
		LinkName       *string    `json:"link_name,omitempty"`
		Description    *string    `json:"description,omitempty"`
		UploadURL      string     `json:"upload_url,omitempty"`
		TargetFolderID string     `json:"target_folder_id"`
		FolderName     string     `json:"folder_name,omitempty"`
		ExpiresAt      *time.Time `json:"expires_at,omitempty"`
		MaxFiles       *int32     `json:"max_files,omitempty"`
		FilesUploaded  int32      `json:"files_uploaded"`
		LastUploadAt   *time.Time `json:"last_upload_at,omitempty"`
		Used           bool       `json:"used"`
		CreatedAt      time.Time  `json:"created_at"`
		HasPassword    bool       `json:"has_password"`
	}

	response := []TokenResponse{}
	for _, t := range tokens {
		uploadURL := fmt.Sprintf("%sdrop/%s", cfg.Product.BasePath, t.Token)

		var expiresAt *time.Time
		if t.ExpiresAt.Valid {
			expiresAt = &t.ExpiresAt.Time
		}
		var maxFiles *int32
		if t.MaxFiles.Valid {
			maxFiles = &t.MaxFiles.Int32
		}
		filesUploaded := int32(0)
		if t.FilesUploaded.Valid {
			filesUploaded = t.FilesUploaded.Int32
		}
		var linkName *string
		if t.LinkName.Valid && t.LinkName.String != "" {
			linkName = &t.LinkName.String
		}
		var description *string
		if t.Description.Valid && t.Description.String != "" {
			description = &t.Description.String
		}
		var lastUpload *time.Time
		if ts, ok := lastUploadAt[t.ID.String()]; ok {
			lastUpload = &ts
		}

		response = append(response, TokenResponse{
			ID:             t.ID.String(),
			Token:          t.Token,
			LinkName:       linkName,
			Description:    description,
			UploadURL:      uploadURL,
			TargetFolderID: t.TargetFolderID.String(),
			ExpiresAt:      expiresAt,
			MaxFiles:       maxFiles,
			FilesUploaded:  filesUploaded,
			LastUploadAt:   lastUpload,
			Used:           t.Used.Valid && t.Used.Bool,
			CreatedAt:      t.CreatedAt.Time,
			HasPassword:    t.PasswordHash.Valid && t.PasswordHash.String != "",
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func (cfg *ApiConfig) handlerDropTokenRecoverKey(w http.ResponseWriter, r *http.Request) {
	// Extract token from URL path
	trimmed := strings.TrimPrefix(r.URL.Path, "/api/drop/")
	trimmed = strings.TrimSuffix(trimmed, "/recover-key")
	tokenStr := strings.TrimSuffix(trimmed, "/")

	if tokenStr == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No token provided"})
		return
	}

	// Authenticate owner
	authToken, err := auth.GetBearerToken(r.Header)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing authorization"})
		return
	}

	ownerID, err := auth.ValidateJWT(authToken, cfg.jwtSecret)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid token"})
		return
	}

	// Look up the upload token
	uploadToken, err := cfg.dbQueries.GetUploadTokenByToken(r.Context(), tokenStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Upload token not found"})
		return
	}

	// Verify caller is the owner
	if uploadToken.OwnerUserID != ownerID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "Not authorized"})
		return
	}

	// Verify pin_wrapped_key exists
	if !uploadToken.PinWrappedKey.Valid || uploadToken.PinWrappedKey.String == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "This link has no recoverable key"})
		return
	}

	// Parse PIN from request body
	var req struct {
		Pin string `json:"pin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Pin == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "pin is required"})
		return
	}

	// Load owner for PIN hash
	owner, err := cfg.dbQueries.GetUserByID(r.Context(), ownerID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not load user"})
		return
	}

	if !owner.PinHash.Valid || owner.PinHash.String == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "PIN not set"})
		return
	}

	// Check PIN lockout
	var lockedUntil *time.Time
	var failedAttempts int
	cfg.db.QueryRowContext(r.Context(),
		"SELECT pin_failed_attempts, pin_locked_until FROM users WHERE id = $1", ownerID,
	).Scan(&failedAttempts, &lockedUntil)
	if lockedUntil != nil && lockedUntil.After(time.Now()) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		json.NewEncoder(w).Encode(map[string]string{"error": "Too many incorrect PIN attempts. Try again after " + lockedUntil.UTC().Format(time.RFC3339)})
		return
	}

	// Verify PIN
	if err := auth.CheckPasswordHash(req.Pin, owner.PinHash.String); err != nil {
		newAttempts := failedAttempts + 1
		if newAttempts >= 5 {
			cfg.db.ExecContext(r.Context(),
				"UPDATE users SET pin_failed_attempts = $1, pin_locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2",
				newAttempts, ownerID)
		} else {
			cfg.db.ExecContext(r.Context(),
				"UPDATE users SET pin_failed_attempts = $1 WHERE id = $2",
				newAttempts, ownerID)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Incorrect PIN"})
		return
	}
	cfg.db.ExecContext(r.Context(),
		"UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = $1", ownerID)

	// Unwrap the key
	rawKey, err := auth.UnwrapKey(req.Pin, uploadToken.PinWrappedKey.String)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not recover encryption key"})
		return
	}

	cfg.insertAudit(r.Context(), ownerID, "secure_drop.key_recovered", "upload_token", &uploadToken.ID, map[string]interface{}{
		"link_name": uploadToken.LinkName.String,
	}, r)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"encryption_key": rawKey})
}

func (cfg *ApiConfig) handlerDropTokenFiles(w http.ResponseWriter, r *http.Request) {
	// Extract drop token from URL path
	pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/drop/"), "/")
	dropTokenStr := ""
	if len(pathParts) > 0 {
		dropTokenStr = pathParts[0]
	}

	if dropTokenStr == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No token provided"})
		return
	}

	// Get auth token from header and validate user
	authToken, err := auth.GetBearerToken(r.Header)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing authorization"})
		return
	}

	ownerID, err := auth.ValidateJWT(authToken, cfg.jwtSecret)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid authorization"})
		return
	}

	// Get upload token by string
	uploadToken, err := cfg.dbQueries.GetUploadTokenByToken(r.Context(), dropTokenStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Token not found"})
		return
	}

	// Verify ownership
	if uploadToken.OwnerUserID != ownerID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "You don't own this token"})
		return
	}

	// Get files uploaded via this token
	files, err := cfg.dbQueries.GetFilesByDropToken(r.Context(), dropTokenStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not fetch files"})
		return
	}

	// Convert to lowercase JSON for frontend consistency
	result := make([]map[string]interface{}, len(files))
	for i, f := range files {
		result[i] = map[string]interface{}{
			"id":          f.ID,
			"filename":    f.Filename,
			"file_size":   f.FileSize,
			"created_at":  f.CreatedAt,
			"drop_token":  f.DropToken,
			"folder_name": f.FolderName,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(result)
}

func (cfg *ApiConfig) handlerDeleteDropToken(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/upload-links/"), "/")
	if len(pathParts) == 0 || pathParts[0] == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "No token ID provided"})
		return
	}

	tokenID := pathParts[0]

	uuidID, err := uuid.Parse(tokenID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid token ID"})
		return
	}

	// Validate user owns this token
	authToken, err := auth.GetBearerToken(r.Header)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing authorization"})
		return
	}

	ownerID, err := auth.ValidateJWT(authToken, cfg.jwtSecret)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid authorization"})
		return
	}

	// Get token by ID to verify ownership
	token, err := cfg.dbQueries.GetUploadTokenByID(r.Context(), uuidID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Token not found"})
		return
	}

	if token.OwnerUserID != ownerID {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"error": "You don't own this token"})
		return
	}

	cfg.dbQueries.ClearDropSourceFromFiles(r.Context(), uuid.NullUUID{UUID: uuidID, Valid: true})

	err = cfg.dbQueries.DeleteUploadToken(r.Context(), uuidID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to delete token"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Upload link deleted",
	})
}

func generateDropToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
