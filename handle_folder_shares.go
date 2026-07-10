package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type CreateFolderShareRequest struct {
	UserID     string `json:"user_id"`
	WrappedKey string `json:"wrapped_key"`
}

type FolderShareResponse struct {
	ID        string    `json:"id"`
	FolderID  string    `json:"folder_id"`
	UserID    string    `json:"user_id"`
	SharedBy  string    `json:"shared_by"`
	CreatedAt time.Time `json:"created_at"`
}

type SharedFolderResponse struct {
	ID         string    `json:"id"`
	OwnerID    string    `json:"owner_id"`
	Name       string    `json:"name"`
	ParentID   string    `json:"parentId,omitempty"`
	WrappedKey string    `json:"wrapped_key"`
	SharedBy   string    `json:"shared_by"`
	SharedAt   time.Time `json:"shared_at"`
}

func (cfg *ApiConfig) handleCreateFolderShare(w http.ResponseWriter, r *http.Request, currentUser database.User) {
	folderIDStr := r.PathValue("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID", err)
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder not found", err)
		return
	}

	if folder.OwnerID != currentUser.ID {
		respondWithError(w, http.StatusForbidden, "You do not own this folder", nil)
		return
	}

	var req CreateFolderShareRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	recipientID, err := uuid.Parse(req.UserID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid recipient user ID", err)
		return
	}

	if req.WrappedKey == "" {
		respondWithError(w, http.StatusBadRequest, "Wrapped key is required", nil)
		return
	}

	// Verify recipient exists
	_, err = cfg.dbQueries.GetUserByID(r.Context(), recipientID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Recipient user not found", err)
		return
	}

	share, err := cfg.dbQueries.CreateFolderShare(r.Context(), database.CreateFolderShareParams{
		FolderID:   folderID,
		UserID:     recipientID,
		WrappedKey: req.WrappedKey,
		SharedBy:   currentUser.ID,
		CreatedAt:  time.Now().UTC(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create folder share", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, FolderShareResponse{
		ID:        share.ID.String(),
		FolderID:  share.FolderID.String(),
		UserID:    share.UserID.String(),
		SharedBy:  share.SharedBy.String(),
		CreatedAt: share.CreatedAt,
	})
}

func (cfg *ApiConfig) handleListFolderShares(w http.ResponseWriter, r *http.Request, currentUser database.User) {
	folderIDStr := r.PathValue("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID", err)
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder not found", err)
		return
	}

	if folder.OwnerID != currentUser.ID {
		respondWithError(w, http.StatusForbidden, "You do not own this folder", nil)
		return
	}

	shares, err := cfg.dbQueries.ListFolderSharesForFolder(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list folder shares", err)
		return
	}

	type ListSharesItem struct {
		ID        string    `json:"id"`
		UserID    string    `json:"user_id"`
		Username  string    `json:"username"`
		SharedBy  string    `json:"shared_by"`
		CreatedAt time.Time `json:"created_at"`
	}

	items := []ListSharesItem{}
	for _, s := range shares {
		u, err := cfg.dbQueries.GetUserByID(r.Context(), s.UserID)
		username := ""
		if err == nil {
			username = u.Username
		}
		items = append(items, ListSharesItem{
			ID:        s.ID.String(),
			UserID:    s.UserID.String(),
			Username:  username,
			SharedBy:  s.SharedBy.String(),
			CreatedAt: s.CreatedAt,
		})
	}

	respondWithJSON(w, http.StatusOK, items)
}

func (cfg *ApiConfig) handleDeleteFolderShare(w http.ResponseWriter, r *http.Request, currentUser database.User) {
	folderIDStr := r.PathValue("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID", err)
		return
	}

	userIDStr := r.PathValue("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder not found", err)
		return
	}

	if folder.OwnerID != currentUser.ID {
		respondWithError(w, http.StatusForbidden, "You do not own this folder", nil)
		return
	}

	err = cfg.dbQueries.DeleteFolderShare(r.Context(), database.DeleteFolderShareParams{
		FolderID: folderID,
		UserID:   userID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete folder share", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiConfig) handleListSharedFolders(w http.ResponseWriter, r *http.Request, currentUser database.User) {
	rows, err := cfg.dbQueries.ListFoldersSharedWithUser(r.Context(), currentUser.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list shared folders", err)
		return
	}

	items := []SharedFolderResponse{}
	for _, row := range rows {
		parentID := ""
		if row.ParentID.Valid {
			parentID = row.ParentID.UUID.String()
		}
		items = append(items, SharedFolderResponse{
			ID:         row.ID.String(),
			OwnerID:    row.OwnerID.String(),
			Name:       row.Name,
			ParentID:   parentID,
			WrappedKey: row.WrappedKey,
			SharedBy:   row.SharedBy.String(),
			SharedAt:   row.SharedAt,
		})
	}

	respondWithJSON(w, http.StatusOK, items)
}

func (cfg *ApiConfig) handleListFolderFiles(w http.ResponseWriter, r *http.Request, currentUser database.User) {
	folderIDStr := r.PathValue("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID", err)
		return
	}

	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder not found", err)
		return
	}

	// Owner check
	hasAccess := folder.OwnerID == currentUser.ID

	// Collaborator check if not owner
	if !hasAccess {
		share, err := cfg.dbQueries.GetFolderShare(r.Context(), database.GetFolderShareParams{
			FolderID: folderID,
			UserID:   currentUser.ID,
		})
		if err == nil && share.UserID == currentUser.ID {
			hasAccess = true
		}
	}

	if !hasAccess {
		respondWithError(w, http.StatusForbidden, "Access denied to this folder", nil)
		return
	}

	files, err := cfg.dbQueries.GetFilesByFolderID(r.Context(), uuid.NullUUID{UUID: folderID, Valid: true})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list folder files", err)
		return
	}

	type FolderFileResponse struct {
		ID        uuid.UUID `json:"id"`
		Filename  string    `json:"filename"`
		FileSize  int64     `json:"file_size"`
		CreatedAt time.Time `json:"created_at"`
		Metadata  string    `json:"metadata"`
		IsOwner   bool      `json:"is_owner"`
	}

	res := []FolderFileResponse{}
	for _, f := range files {
		meta := ""
		if f.EncryptedMetadata.Valid {
			meta = f.EncryptedMetadata.String
		}
		res = append(res, FolderFileResponse{
			ID:        f.ID,
			Filename:  f.Filename,
			FileSize:  f.FileSize,
			CreatedAt: f.CreatedAt,
			Metadata:  meta,
			IsOwner:   f.OwnerID.Valid && f.OwnerID.UUID == currentUser.ID,
		})
	}

	respondWithJSON(w, http.StatusOK, res)
}
