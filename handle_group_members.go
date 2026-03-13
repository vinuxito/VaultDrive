package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/Pranay0205/VaultDrive/internal/database"
)

func nullTimeToString(nt sql.NullTime) string {
	if !nt.Valid {
		return ""
	}
	return nt.Time.Format("2006-01-02T15:04:05Z07:00")
}

func (cfg *ApiConfig) getGroupMembersHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	members, err := cfg.dbQueries.GetGroupMembers(context.Background(), id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error fetching members", err)
		return
	}

	type MemberResponse struct {
		ID        string `json:"id"`
		UserID    string `json:"user_id"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Role      string `json:"role"`
		CreatedAt string `json:"created_at"`
	}

	response := make([]MemberResponse, len(members))
	for i, m := range members {
		response[i] = MemberResponse{
			ID:        m.ID.String(),
			UserID:    m.UserID.String(),
			Username:  m.Username,
			Email:     m.Email,
			FirstName: m.FirstName,
			LastName:  m.LastName,
			Role:      nullStringToString(m.Role),
			CreatedAt: nullTimeToString(m.CreatedAt),
		}
	}

	respondWithJSON(w, http.StatusOK, response)
}

func (cfg *ApiConfig) addGroupMemberHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	groupID, err := parseUUID(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	type AddMemberRequest struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}

	var req AddMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	memberUserID, err := parseUUID(req.UserID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	member, err := cfg.dbQueries.AddGroupMember(context.Background(), database.AddGroupMemberParams{
		GroupID: groupID,
		UserID:  memberUserID,
		Role:    databaseToNullString(req.Role),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error adding member", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         member.ID,
		"user_id":    member.UserID,
		"group_id":   member.GroupID,
		"role":       nullStringToString(member.Role),
		"created_at": nullTimeToString(member.CreatedAt),
	})
}

func (cfg *ApiConfig) removeGroupMemberHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	groupID, err := parseUUID(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	userIDStr := r.PathValue("userId")
	userID, err := parseUUID(userIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	_, err = cfg.dbQueries.IsUserInGroup(context.Background(), database.IsUserInGroupParams{
		GroupID: groupID,
		UserID:  user.ID,
	})
	if err != nil {
		respondWithError(w, http.StatusForbidden, "You are not a member of this group", err)
		return
	}

	err = cfg.dbQueries.RemoveGroupMember(context.Background(), database.RemoveGroupMemberParams{
		GroupID: groupID,
		UserID:  userID,
	})
	if err != nil {
		log.Printf("Error removing member: %v", err)
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Member removed"})
}

func (cfg *ApiConfig) getGroupFilesHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	id, err := parseUUID(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	files, err := cfg.dbQueries.GetGroupFiles(context.Background(), id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error fetching files", err)
		return
	}

	// Format response with snake_case field names for frontend
	response := make([]map[string]interface{}, len(files))
	for i, file := range files {
		response[i] = map[string]interface{}{
			"id":               file.ID,
			"file_id":          file.ID,
			"filename":         file.Filename,
			"file_size":        file.FileSize,
			"shared_at":        nullTimeToString(file.SharedAt),
			"shared_by":        file.SharedBy,
			"created_at":       file.CreatedAt,
			"metadata":         nullStringToString(file.EncryptedMetadata_2),
		}
	}

	respondWithJSON(w, http.StatusOK, response)
}

func (cfg *ApiConfig) shareFileToGroupHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	groupIDStr := r.PathValue("id")
	groupID, err := parseUUID(groupIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	type ShareFileToGroupRequest struct {
		FileID     string `json:"file_id"`
		WrappedKey string `json:"wrapped_key"`
	}

	var req ShareFileToGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.FileID == "" {
		respondWithError(w, http.StatusBadRequest, "File ID is required", nil)
		return
	}

	if req.WrappedKey == "" {
		respondWithError(w, http.StatusBadRequest, "Wrapped key is required", nil)
		return
	}

	fileID, err := parseUUID(req.FileID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	share, err := cfg.dbQueries.ShareFileToGroup(context.Background(), database.ShareFileToGroupParams{
		GroupID:    groupID,
		FileID:     fileID,
		WrappedKey: req.WrappedKey,
		CreatedBy:  user.ID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error sharing file", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         share.ID,
		"group_id":   share.GroupID,
		"file_id":    share.FileID,
		"created_at": nullTimeToString(share.CreatedAt),
	})
}

func (cfg *ApiConfig) removeFileFromGroupHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	groupIDStr := r.PathValue("groupId")
	groupID, err := parseUUID(groupIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid group ID", err)
		return
	}

	fileIDStr := r.PathValue("fileId")
	fileID, err := parseUUID(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	err = cfg.dbQueries.RemoveFileFromGroup(context.Background(), database.RemoveFileFromGroupParams{
		GroupID: groupID,
		FileID:  fileID,
	})
	if err != nil {
		log.Printf("Error removing file from group: %v", err)
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "File removed from group"})
}
