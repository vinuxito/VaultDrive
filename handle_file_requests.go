package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

type fileRequestResponse struct {
	ID           string     `json:"id"`
	Token        string     `json:"token"`
	Description  string     `json:"description"`
	ExpiresAt    *time.Time `json:"expires_at"`
	IsActive     bool       `json:"is_active"`
	MaxFileSize  *int64     `json:"max_file_size"`
	UploadedCount int       `json:"uploaded_count"`
	RequestURL   string     `json:"request_url"`
	CreatedAt    time.Time  `json:"created_at"`
}

func dbFileRequestToResponse(req database.FileRequest) fileRequestResponse {
	resp := fileRequestResponse{
		ID:          req.ID.String(),
		Token:       req.Token,
		Description: req.Description.String,
		IsActive:    req.IsActive.Bool,
		RequestURL:  fmt.Sprintf("/abrn/request/%s", req.Token),
		CreatedAt:   req.CreatedAt,
	}
	if req.ExpiresAt.Valid {
		t := req.ExpiresAt.Time
		resp.ExpiresAt = &t
	}
	if req.MaxFileSize.Valid {
		resp.MaxFileSize = &req.MaxFileSize.Int64
	}
	if req.UploadedFiles.RawMessage != nil {
		var files []interface{}
		if json.Unmarshal(req.UploadedFiles.RawMessage, &files) == nil {
			resp.UploadedCount = len(files)
		}
	}
	return resp
}

func (cfg *ApiConfig) handlerCreateFileRequest(w http.ResponseWriter, r *http.Request, user database.User) {
	var body struct {
		Description string `json:"description"`
		ExpiresAt   string `json:"expires_at"`
		MaxFileSize int64  `json:"max_file_size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not generate token", err)
		return
	}
	token := hex.EncodeToString(tokenBytes)

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

	var maxFileSize sql.NullInt64
	if body.MaxFileSize > 0 {
		maxFileSize = sql.NullInt64{Int64: body.MaxFileSize, Valid: true}
	}

	emptyFiles, _ := json.Marshal([]interface{}{})

	req, err := cfg.dbQueries.CreateFileRequest(r.Context(), database.CreateFileRequestParams{
		OwnerID:       user.ID,
		Token:         token,
		Description:   sql.NullString{String: body.Description, Valid: body.Description != ""},
		ExpiresAt:     expiresAt,
		MaxFileSize:   maxFileSize,
		IsActive:      sql.NullBool{Bool: true, Valid: true},
		UploadedFiles: pqtype.NullRawMessage{RawMessage: emptyFiles, Valid: true},
		CreatedAt:     time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not create file request", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, dbFileRequestToResponse(req))
}

func (cfg *ApiConfig) handlerListFileRequests(w http.ResponseWriter, r *http.Request, user database.User) {
	reqs, err := cfg.dbQueries.GetFileRequestsByOwner(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not list file requests", err)
		return
	}
	result := make([]fileRequestResponse, 0, len(reqs))
	for _, req := range reqs {
		result = append(result, dbFileRequestToResponse(req))
	}
	respondWithJSON(w, http.StatusOK, result)
}

func (cfg *ApiConfig) handlerRevokeFileRequest(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	if idStr == "" {
		respondWithError(w, http.StatusBadRequest, "ID required", nil)
		return
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid ID", err)
		return
	}
	_, err = cfg.dbQueries.RevokeFileRequest(r.Context(), database.RevokeFileRequestParams{
		ID:      id,
		OwnerID: user.ID,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not revoke file request", err)
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (cfg *ApiConfig) handlerGetFileRequestInfo(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		respondWithError(w, http.StatusBadRequest, "Token required", nil)
		return
	}

	req, err := cfg.dbQueries.GetFileRequestByToken(r.Context(), token)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File request not found or inactive", nil)
		return
	}

	if req.ExpiresAt.Valid && req.ExpiresAt.Time.Before(time.Now()) {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{"is_expired": true})
		return
	}

	ownerDisplayName := ""
	ownerOrg := ""
	cfg.db.QueryRowContext(r.Context(),
		`SELECT COALESCE(first_name||' '||last_name,''), COALESCE(organization_name,'') FROM users WHERE id = $1`,
		req.OwnerID,
	).Scan(&ownerDisplayName, &ownerOrg)

	var expiresAt *string
	if req.ExpiresAt.Valid {
		s := req.ExpiresAt.Time.UTC().Format(time.RFC3339)
		expiresAt = &s
	}

	var uploadedCount int
	if req.UploadedFiles.RawMessage != nil {
		var files []interface{}
		if json.Unmarshal(req.UploadedFiles.RawMessage, &files) == nil {
			uploadedCount = len(files)
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"description":         req.Description.String,
		"expires_at":          expiresAt,
		"is_expired":          false,
		"owner_display_name":  ownerDisplayName,
		"owner_organization":  ownerOrg,
		"uploaded_count":      uploadedCount,
		"max_file_size":       req.MaxFileSize.Int64,
	})
}

func (cfg *ApiConfig) handlerFileRequestUpload(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		respondWithError(w, http.StatusBadRequest, "Token required", nil)
		return
	}

	req, err := cfg.dbQueries.GetFileRequestByToken(r.Context(), token)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File request not found or inactive", nil)
		return
	}

	if req.ExpiresAt.Valid && req.ExpiresAt.Time.Before(time.Now()) {
		respondWithError(w, http.StatusForbidden, "File request has expired", nil)
		return
	}

	if err := r.ParseMultipartForm(2 << 30); err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to parse multipart form", err)
		return
	}

	uploadDir := "uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not create uploads directory", err)
		return
	}

	type uploadResult struct {
		FileID   string `json:"file_id"`
		Filename string `json:"filename"`
	}
	var results []uploadResult

	for _, fileHeaders := range r.MultipartForm.File {
		for _, fh := range fileHeaders {
			originalName := filepath.Base(fh.Filename)
			if originalName == "" || originalName == "." {
				continue
			}

			if req.MaxFileSize.Valid && fh.Size > req.MaxFileSize.Int64 {
				respondWithError(w, http.StatusRequestEntityTooLarge,
					fmt.Sprintf("File %s exceeds maximum size", originalName), nil)
				return
			}

			f, err := fh.Open()
			if err != nil {
				log.Printf("Failed to open uploaded file: %v", err)
				continue
			}

			fileIDForPath := uuid.New()
			ext := filepath.Ext(originalName)
			storedName := fileIDForPath.String() + ext
			storagePath := filepath.Join(uploadDir, storedName)

			dst, err := os.Create(storagePath)
			if err != nil {
				f.Close()
				log.Printf("Failed to create storage file: %v", err)
				continue
			}
			if _, err := io.Copy(dst, f); err != nil {
				f.Close()
				dst.Close()
				os.Remove(storagePath)
				continue
			}
			f.Close()
			dst.Close()

			iv := r.FormValue("iv")
			algorithm := r.FormValue("algorithm")
			clientMessage := r.FormValue("client_message")

			metaMap := map[string]string{"iv": iv, "algorithm": algorithm}
			if clientMessage != "" {
				metaMap["client_message"] = clientMessage
			}
			metaJSON, _ := json.Marshal(metaMap)

			now := time.Now()
			fi, _ := os.Stat(storagePath)
			var fileSize int64
			if fi != nil {
				fileSize = fi.Size()
			}

			pinWrappedKey := r.FormValue("pin_wrapped_key")
			createdFile, err := cfg.dbQueries.CreateFile(r.Context(), database.CreateFileParams{
				OwnerID:           uuid.NullUUID{UUID: req.OwnerID, Valid: true},
				Filename:          originalName,
				FilePath:          storagePath,
				FileSize:          fileSize,
				EncryptedMetadata: sql.NullString{String: string(metaJSON), Valid: true},
				CreatedAt:         now,
				UpdatedAt:         now,
			})
			if err != nil {
				os.Remove(storagePath)
				log.Printf("Failed to create file record: %v", err)
				continue
			}

			if pinWrappedKey != "" {
				cfg.dbQueries.CreateFileAccessKey(r.Context(), database.CreateFileAccessKeyParams{
					FileID:     uuid.NullUUID{UUID: createdFile.ID, Valid: true},
					UserID:     uuid.NullUUID{UUID: req.OwnerID, Valid: true},
					WrappedKey: pinWrappedKey,
				})
			}

			fileEntry := map[string]string{
				"file_id":  createdFile.ID.String(),
				"filename": originalName,
				"size":     fmt.Sprintf("%d", fileSize),
			}
			fileEntryJSON, _ := json.Marshal(fileEntry)
			appendJSON := json.RawMessage(fmt.Sprintf("[%s]", string(fileEntryJSON)))

			cfg.dbQueries.AddUploadedFile(r.Context(), database.AddUploadedFileParams{
				ID:            req.ID,
				UploadedFiles: pqtype.NullRawMessage{RawMessage: appendJSON, Valid: true},
				UpdatedAt:     now,
			})

			cfg.dbQueries.InsertActivity(r.Context(), database.InsertActivityParams{
				UserID:    req.OwnerID,
				EventType: "file_request_upload",
				Payload: pqtype.NullRawMessage{
					RawMessage: json.RawMessage(fmt.Sprintf(`{"filename":%q,"request_token":%q}`,
						originalName, strings.TrimSpace(token[:min(8, len(token))]))),
					Valid: true,
				},
			})

			results = append(results, uploadResult{FileID: createdFile.ID.String(), Filename: originalName})
		}
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"uploaded": results,
		"count":    len(results),
	})
}


