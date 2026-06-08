package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/vinuxito/VaultDrive/internal/database"
	"github.com/google/uuid"
)

type publicShareLinkResponse struct {
	ID           uuid.UUID  `json:"id"`
	Token        string     `json:"token"`
	FileID       uuid.UUID  `json:"file_id"`
	ExpiresAt    *time.Time `json:"expires_at"`
	UnlockAt     *time.Time `json:"unlock_at"`
	MaxDownloads int32      `json:"max_downloads"`
	IsActive     bool       `json:"is_active"`
	CreatedAt    time.Time  `json:"created_at"`
}

func dbShareLinkToResponse(link database.PublicShareLink) publicShareLinkResponse {
	resp := publicShareLinkResponse{
		ID:           link.ID,
		Token:        link.Token,
		FileID:       link.FileID,
		MaxDownloads: link.MaxDownloads,
		IsActive:     link.IsActive,
		CreatedAt:    link.CreatedAt,
	}
	if link.ExpiresAt.Valid {
		resp.ExpiresAt = &link.ExpiresAt.Time
	}
	if link.UnlockAt.Valid {
		resp.UnlockAt = &link.UnlockAt.Time
	}
	return resp
}

func (cfg *ApiConfig) handlerCreatePublicShareLink(w http.ResponseWriter, r *http.Request, user database.User) {
	fileIDStr := r.PathValue("fileId")
	if fileIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "File ID is required", nil)
		return
	}

	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID format", err)
		return
	}

	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "File not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving file", err)
		return
	}

	if !dbFile.OwnerID.Valid || dbFile.OwnerID.UUID != user.ID {
		respondWithError(w, http.StatusForbidden, "You do not own this file", nil)
		return
	}

	var body struct {
		ExpiresAt    string `json:"expires_at"`
		UnlockAt     string `json:"unlock_at"`
		MaxDownloads int32  `json:"max_downloads"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil && err != io.EOF {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
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

	var unlockAt sql.NullTime
	if body.UnlockAt != "" {
		t, err := time.Parse(time.RFC3339, body.UnlockAt)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid unlock_at format, use RFC3339", err)
			return
		}
		unlockAt = sql.NullTime{Time: t, Valid: true}
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not generate token", err)
		return
	}
	token := hex.EncodeToString(tokenBytes)

	link, err := cfg.dbQueries.CreatePublicShareLink(r.Context(), database.CreatePublicShareLinkParams{
		FileID:       fileID,
		OwnerID:      user.ID,
		Token:        token,
		ExpiresAt:    expiresAt,
		UnlockAt:     unlockAt,
		MaxDownloads: body.MaxDownloads,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not create share link", err)
		return
	}
	cfg.insertActivity(r.Context(), user.ID, "public_share_link_created", map[string]interface{}{
		"file_id":       fileID.String(),
		"filename":    dbFile.Filename,
		"share_link_id": link.ID.String(),
		"expires_at":  expiresAt,
	})
	cfg.insertAudit(r.Context(), user.ID, "public_share_link.created", "public_share_link", &link.ID, map[string]interface{}{
		"file_id":  fileID.String(),
		"filename": dbFile.Filename,
	}, r)

	respondWithJSON(w, http.StatusCreated, dbShareLinkToResponse(link))
}

func (cfg *ApiConfig) handlerGetPublicShareLinkInfo(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		respondWithError(w, http.StatusBadRequest, "Token is required", nil)
		return
	}

	link, err := cfg.dbQueries.GetPublicShareLinkByToken(r.Context(), token)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Share link not found", nil)
		return
	}

	isShredded := !link.IsActive && link.MaxDownloads > 0 && link.AccessCount >= link.MaxDownloads
	if isShredded {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"is_expired":   true,
			"is_shredded":  true,
			"is_active":    false,
			"access_count": link.AccessCount,
		})
		return
	}

	if !link.IsActive {
		respondWithError(w, http.StatusForbidden, "Share link is inactive", nil)
		return
	}

	if link.ExpiresAt.Valid && link.ExpiresAt.Time.Before(time.Now()) {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"is_expired": true,
			"expires_at": link.ExpiresAt.Time.UTC().Format(time.RFC3339),
		})
		return
	}

	isLocked := link.UnlockAt.Valid && link.UnlockAt.Time.After(time.Now())
	var unlockAt *string
	if link.UnlockAt.Valid {
		s := link.UnlockAt.Time.UTC().Format(time.RFC3339)
		unlockAt = &s
	}

	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), link.FileID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File not found", nil)
		return
	}

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

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"filename":            dbFile.Filename,
		"file_size":           dbFile.FileSize,
		"expires_at":          expiresAt,
		"is_expired":          false,
		"is_locked":           isLocked,
		"unlock_at":           unlockAt,
		"max_downloads":       link.MaxDownloads,
		"owner_display_name":  ownerDisplayName,
		"owner_organization":  ownerOrg,
		"access_count":        link.AccessCount,
	})
}

func (cfg *ApiConfig) handlerGetPublicShareLinkFile(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		respondWithError(w, http.StatusBadRequest, "Token is required", nil)
		return
	}

	link, err := cfg.dbQueries.GetPublicShareLinkByToken(r.Context(), token)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "Share link not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error looking up share link", err)
		return
	}

	isShredded := !link.IsActive && link.MaxDownloads > 0 && link.AccessCount >= link.MaxDownloads
	if isShredded {
		respondWithError(w, http.StatusGone, "This share link has been permanently shredded", nil)
		return
	}

	if !link.IsActive {
		respondWithError(w, http.StatusForbidden, "Share link is inactive", nil)
		return
	}

	if link.ExpiresAt.Valid && link.ExpiresAt.Time.Before(time.Now()) {
		respondWithError(w, http.StatusForbidden, "Share link has expired", nil)
		return
	}

	if link.UnlockAt.Valid && link.UnlockAt.Time.After(time.Now()) {
		respondWithError(w, http.StatusForbidden, "This share link is time-locked", nil)
		return
	}

	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), link.FileID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "File not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving file", err)
		return
	}

	file, err := os.Open(dbFile.FilePath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not read file from disk", err)
		return
	}
	defer file.Close()

	// Update access count and optionally deactivate if auto-shredding is triggered
	_, err = cfg.db.ExecContext(r.Context(),
		`UPDATE public_share_links 
		 SET access_count = access_count + 1, 
		     last_accessed_at = NOW(),
		     is_active = CASE WHEN max_downloads > 0 AND access_count + 1 >= max_downloads THEN FALSE ELSE is_active END
		 WHERE token = $1`,
		token)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error updating access count", err)
		return
	}

	w.Header().Set("X-File-Name", dbFile.Filename)
	w.Header().Set("Content-Type", "application/octet-stream")
	if dbFile.EncryptedMetadata.Valid {
		w.Header().Set("X-File-Metadata", dbFile.EncryptedMetadata.String)
	}

	_, _ = io.Copy(w, file)

	// Log download audit event
	actorDetails := map[string]interface{}{
		"actor_type": "anonymous_link",
		"link_id":    link.ID.String(),
		"filename":   dbFile.Filename,
		"file_size":  dbFile.FileSize,
	}
	cfg.insertAudit(r.Context(), link.OwnerID, "file.downloaded", "file", &dbFile.ID, actorDetails, r)
}


func (cfg *ApiConfig) handlerListPublicShareLinks(w http.ResponseWriter, r *http.Request, user database.User) {
	fileIDStr := r.PathValue("fileId")
	if fileIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "File ID is required", nil)
		return
	}

	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID format", err)
		return
	}

	links, err := cfg.dbQueries.ListPublicShareLinksByOwner(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error retrieving share links", err)
		return
	}

	result := make([]publicShareLinkResponse, 0)
	for _, link := range links {
		if link.FileID == fileID {
			result = append(result, dbShareLinkToResponse(link))
		}
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (cfg *ApiConfig) handlerRevokePublicShareLink(w http.ResponseWriter, r *http.Request, user database.User) {
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

	err = cfg.dbQueries.RevokePublicShareLink(r.Context(), database.RevokePublicShareLinkParams{
		ID:      linkID,
		OwnerID: user.ID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error revoking share link", err)
		return
	}
	cfg.insertActivity(r.Context(), user.ID, "public_share_link_revoked", map[string]interface{}{
		"share_link_id": linkID.String(),
	})
	cfg.insertAudit(r.Context(), user.ID, "public_share_link.revoked", "public_share_link", &linkID, nil, r)

	respondWithJSON(w, http.StatusOK, map[string]string{
		"status":  "success",
		"message": "Share link revoked",
	})
}
