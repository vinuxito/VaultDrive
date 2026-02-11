package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
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

	// Validate key if token has password
	key := r.URL.Query().Get("key")
	if uploadToken.PasswordHash.Valid && uploadToken.PasswordHash.String != "" {
		if key == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Encryption key required"})
			return
		}
		// Validate by comparing wrapped keys (they should match if same key was used)
		if key != uploadToken.PasswordHash.String {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Invalid encryption key"})
			return
		}
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

	// Build response with proper value extraction
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

	response := map[string]interface{}{
		"valid":       true,
		"folder_name": folder.Name,
		"files_limit": filesLimit,
		"uploaded":    uploaded,
		"expires_at":  expiresAt,
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

	// Get the uploaded file
	file, handler, err := r.FormFile("file")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error retrieving the file"})
		return
	}
	defer file.Close()

	uploadDir := "uploads"
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		err = os.Mkdir(uploadDir, 0755)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Could not create uploads directory"})
			return
		}
	}

	filename := uuid.New().String() + filepath.Ext(handler.Filename)
	filePath := filepath.Join(uploadDir, filename)

	dst, err := os.Create(filePath)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not create file on server"})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not save file"})
		return
	}

	// Validate password by trying to unwrap the key
	providedPassword := r.FormValue("password")
	if providedPassword == "" {
		os.Remove(filePath)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Password is required"})
		return
	}

	// Validate the wrapped key by comparing with stored key
	storedWrappedKey := uploadToken.PasswordHash.String
	providedWrappedKey := r.FormValue("password")
	if providedWrappedKey != storedWrappedKey {
		os.Remove(filePath)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid encryption key"})
		return
	}

	metadata := map[string]string{
		"iv":        r.FormValue("iv"),
		"salt":      r.FormValue("salt"),
		"algorithm": r.FormValue("algorithm"),
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		os.Remove(filePath)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error processing metadata"})
		return
	}

	dbfile, err := cfg.dbQueries.CreateFile(r.Context(), database.CreateFileParams{
		OwnerID:           uuid.NullUUID{UUID: uploadToken.OwnerUserID, Valid: true},
		Filename:          handler.Filename,
		FilePath:          filePath,
		FileSize:          handler.Size,
		EncryptedMetadata: sql.NullString{String: string(metadataJSON), Valid: true},
		CurrentKeyVersion: sql.NullInt32{Int32: 1, Valid: true},
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
		DropSourceID:      uuid.NullUUID{UUID: uploadToken.ID, Valid: true},
	})

	if err != nil {
		os.Remove(filePath)
		cfg.dbQueries.DeleteFile(r.Context(), dbfile.ID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not create file entry"})
		return
	}

	wrappedKey := r.FormValue("wrapped_key")
	_, err = cfg.dbQueries.CreateFileAccessKey(r.Context(), database.CreateFileAccessKeyParams{
		FileID:     uuid.NullUUID{UUID: dbfile.ID, Valid: true},
		UserID:     uuid.NullUUID{UUID: uploadToken.OwnerUserID, Valid: true},
		WrappedKey: wrappedKey,
	})

	if err != nil {
		os.Remove(filePath)
		cfg.dbQueries.DeleteFile(r.Context(), dbfile.ID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not save file access key"})
		return
	}

	_, err = cfg.dbQueries.IncrementTokenFileCount(r.Context(), uploadToken.ID)
	if err != nil {
		os.Remove(filePath)
		cfg.dbQueries.DeleteFile(r.Context(), dbfile.ID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not update file count"})
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"file_name":  dbfile.Filename,
		"file_id":    dbfile.ID,
		"created_at": dbfile.CreatedAt,
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
		TargetFolderID string `json:"target_folder_id"`
		ExpiresAt      string `json:"expires_at"`
		MaxFiles       int    `json:"max_files"`
		Password       string `json:"password"`
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

	// Generate random encryption key for files
	randomKeyBytes := make([]byte, 32)
	_, err = rand.Read(randomKeyBytes)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not generate encryption key"})
		return
	}
	randomKey := string(randomKeyBytes)

	// Wrap the key with the password for secure storage
	wrappedKey, err := auth.WrapKey(req.Password, randomKey)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not wrap encryption key"})
		return
	}

	// Store the wrapped key in the database
	uploadToken, err := cfg.dbQueries.CreateUploadToken(r.Context(), database.CreateUploadTokenParams{
		Token:          dropToken,
		OwnerUserID:    ownerID,
		TargetFolderID: folderID,
		ExpiresAt:      expiresAt,
		MaxFiles:       maxFiles,
		PasswordHash:   sql.NullString{String: wrappedKey, Valid: true},
	})

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Could not create upload token"})
		return
	}

	uploadURL := fmt.Sprintf("/abrn/drop/%s?key=%s", dropToken, wrappedKey)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":               uploadToken.ID,
		"token":            dropToken,
		"target_folder_id": uploadToken.TargetFolderID,
		"expires_at":       uploadToken.ExpiresAt,
		"max_files":        uploadToken.MaxFiles,
		"upload_url":       uploadURL,
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

	// Build response with upload URLs
	type TokenResponse struct {
		ID             string        `json:"id"`
		Token          string        `json:"token"`
		UploadURL      string        `json:"upload_url,omitempty"`
		TargetFolderID string        `json:"target_folder_id"`
		FolderName     string        `json:"folder_name,omitempty"`
		ExpiresAt      sql.NullTime  `json:"expires_at,omitempty"`
		MaxFiles       sql.NullInt32 `json:"max_files,omitempty"`
		FilesUploaded  sql.NullInt32 `json:"files_uploaded,omitempty"`
		Used           sql.NullBool  `json:"used,omitempty"`
		CreatedAt      time.Time     `json:"created_at"`
		HasPassword    bool          `json:"has_password"`
	}

	response := []TokenResponse{}
	for _, t := range tokens {
		uploadURL := fmt.Sprintf("/abrn/drop/%s", t.Token)
		if t.PasswordHash.Valid && t.PasswordHash.String != "" {
			uploadURL = fmt.Sprintf("/abrn/drop/%s?key=%s", t.Token, t.PasswordHash.String)
		}

		response = append(response, TokenResponse{
			ID:             t.ID.String(),
			Token:          t.Token,
			UploadURL:      uploadURL,
			TargetFolderID: t.TargetFolderID.String(),
			ExpiresAt:      t.ExpiresAt,
			MaxFiles:       t.MaxFiles,
			FilesUploaded:  t.FilesUploaded,
			Used:           t.Used,
			CreatedAt:      t.CreatedAt.Time,
			HasPassword:    t.PasswordHash.Valid && t.PasswordHash.String != "",
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
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
