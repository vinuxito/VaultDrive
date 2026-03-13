package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
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

	type CreateFolderRequest struct {
		Name     string `json:"name"`
		ParentID string `json:"parentId,omitempty"` // Optional - empty for root folders
	}

	var req CreateFolderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if req.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Name is required", nil)
		return
	}

	// Validate parent folder if provided
	var parentUUID uuid.NullUUID
	if req.ParentID != "" {
		parsedParentID, err := uuid.Parse(req.ParentID)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid parent ID format", err)
			return
		}

		// Verify parent exists and is owned by user
		parentFolder, err := cfg.dbQueries.GetFolderByID(r.Context(), parsedParentID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "Parent folder not found", err)
			return
		}

		if parentFolder.OwnerID != userID {
			respondWithError(w, http.StatusForbidden, "Parent folder not owned by user", nil)
			return
		}

		parentUUID = uuid.NullUUID{UUID: parsedParentID, Valid: true}
	}

	folder, err := cfg.dbQueries.CreateFolder(r.Context(), database.CreateFolderParams{
		OwnerID:   userID,
		Name:      req.Name,
		ParentID:  parentUUID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create folder", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, toFolderResponse(folder))
}

func (cfg *ApiConfig) handleUpdateFolder(w http.ResponseWriter, r *http.Request) {
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

	// Extract folder ID from path parameter
	folderIDStr := r.PathValue("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID", err)
		return
	}

	type UpdateFolderRequest struct {
		Name     string `json:"name"`
		ParentID string `json:"parentId,omitempty"` // Optional - can move folders
	}

	var req UpdateFolderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if req.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Name is required", nil)
		return
	}

	// Verify folder exists and is owned by user
	existingFolder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder not found", err)
		return
	}

	if existingFolder.OwnerID != userID {
		respondWithError(w, http.StatusForbidden, "You don't own this folder", nil)
		return
	}

	// Validate parent folder if moving
	var parentUUID uuid.NullUUID
	if req.ParentID != "" {
		parentID, err := uuid.Parse(req.ParentID)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid parent ID", err)
			return
		}

		// Prevent setting folder as its own parent
		if parentID == folderID {
			respondWithError(w, http.StatusBadRequest, "Cannot set folder as its own parent", nil)
			return
		}

		// Verify parent exists and is owned by user
		parentFolder, err := cfg.dbQueries.GetFolderByID(r.Context(), parentID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "Parent folder not found", err)
			return
		}

		if parentFolder.OwnerID != userID {
			respondWithError(w, http.StatusForbidden, "Parent folder not owned by user", nil)
			return
		}

		parentUUID = uuid.NullUUID{UUID: parentID, Valid: true}
	} else {
		// Empty parentId means move to root
		parentUUID = uuid.NullUUID{Valid: false}
	}

	// Update folder
	updatedFolder, err := cfg.dbQueries.UpdateFolder(r.Context(), database.UpdateFolderParams{
		ID:        folderID,
		Name:      req.Name,
		ParentID:  parentUUID,
		UpdatedAt: time.Now().UTC(),
		OwnerID:   userID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update folder", err)
		return
	}

	respondWithJSON(w, http.StatusOK, toFolderResponse(updatedFolder))
}

func (cfg *ApiConfig) handleDeleteFolder(w http.ResponseWriter, r *http.Request) {
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

	// Extract folder ID from path parameter
	folderIDStr := r.PathValue("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid folder ID", err)
		return
	}

	// Verify folder exists and is owned by user
	folder, err := cfg.dbQueries.GetFolderByID(r.Context(), folderID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Folder not found", err)
		return
	}

	if folder.OwnerID != userID {
		respondWithError(w, http.StatusForbidden, "You don't own this folder", nil)
		return
	}

	// Delete folder (CASCADE will delete children automatically)
	err = cfg.dbQueries.DeleteFolder(r.Context(), database.DeleteFolderParams{
		ID:      folderID,
		OwnerID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete folder", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Folder deleted successfully",
	})
}
