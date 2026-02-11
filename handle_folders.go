package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
)

type FolderResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ParentID  string `json:"parentId"`
	CreatedAt string `json:"createdAt"`
}

func toFolderResponse(folder database.Folder) FolderResponse {
	parentID := ""
	if folder.ParentID.Valid {
		parentID = folder.ParentID.UUID.String()
	}

	return FolderResponse{
		ID:        folder.ID.String(),
		Name:      folder.Name,
		ParentID:  parentID,
		CreatedAt: folder.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

func (cfg *ApiConfig) handleListFolders(w http.ResponseWriter, r *http.Request) {
	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	userID, err := auth.ValidateJWT(token, cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	folders, err := cfg.dbQueries.GetFoldersByOwner(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list folders", err)
		return
	}

	response := []FolderResponse{}
	for _, folder := range folders {
		response = append(response, toFolderResponse(folder))
	}

	respondWithJSON(w, http.StatusOK, response)
}

func (cfg *ApiConfig) handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	userID, err := auth.ValidateJWT(token, cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if req.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Name is required", nil)
		return
	}

	folder, err := cfg.dbQueries.CreateFolder(r.Context(), database.CreateFolderParams{
		OwnerID:   userID,
		Name:      req.Name,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create folder", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, toFolderResponse(folder))
}
