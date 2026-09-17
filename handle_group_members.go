package main

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
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

	if _, err := groupAuthorizationFor(r.Context(), cfg.dbQueries, id, user.ID); err != nil {
		respondGroupAuthorizationError(w, err)
		return
	}
	members, err := cfg.dbQueries.GetGroupMembers(r.Context(), id)
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
	if err := decodeGroupRequest(w, r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}
	req.Role = strings.TrimSpace(req.Role)
	if req.Role == "" {
		req.Role = "member"
	}
	if req.Role != "member" {
		respondWithError(w, http.StatusBadRequest, "Only the member role can be assigned", nil)
		return
	}

	memberUserID, err := parseUUID(req.UserID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error adding member", err)
		return
	}
	defer tx.Rollback()
	queries := cfg.dbQueries.WithTx(tx)
	authz, err := groupAuthorizationFor(r.Context(), queries, groupID, user.ID)
	if err != nil {
		respondGroupAuthorizationError(w, err)
		return
	}
	if !authz.owner {
		respondWithError(w, http.StatusForbidden, "Only the group owner can add members", nil)
		return
	}
	if _, err := queries.GetUserByID(r.Context(), memberUserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "User not found", nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "Could not verify member", err)
		}
		return
	}
	member, err := queries.AddGroupMember(r.Context(), database.AddGroupMemberParams{
		GroupID: groupID,
		UserID:  memberUserID,
		Role:    databaseToNullString(req.Role),
	})
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			respondWithError(w, http.StatusConflict, "User is already a group member", nil)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error adding member", err)
		return
	}
	if err := recordGroupMutation(r.Context(), queries, r, user.ID, "group.member_added", "group_member_added", "group", groupID, map[string]string{"member_user_id": memberUserID.String(), "role": req.Role}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error recording member addition", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error committing member addition", err)
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

	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error removing member", err)
		return
	}
	defer tx.Rollback()
	queries := cfg.dbQueries.WithTx(tx)
	authz, err := groupAuthorizationFor(r.Context(), queries, groupID, user.ID)
	if err != nil {
		respondGroupAuthorizationError(w, err)
		return
	}
	if !authz.owner {
		respondWithError(w, http.StatusForbidden, "Only the group owner can remove members", nil)
		return
	}
	if userID == authz.group.UserID {
		respondWithError(w, http.StatusBadRequest, "The group owner cannot be removed", nil)
		return
	}
	var removed uuid.UUID
	if err := tx.QueryRowContext(r.Context(), `DELETE FROM group_members WHERE group_id=$1 AND user_id=$2 RETURNING id`, groupID, userID).Scan(&removed); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "Group member not found", nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "Error removing member", err)
		}
		return
	}
	if err := recordGroupMutation(r.Context(), queries, r, user.ID, "group.member_removed", "group_member_removed", "group", groupID, map[string]string{"member_user_id": userID.String()}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error recording member removal", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error committing member removal", err)
		return
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

	if _, err := groupAuthorizationFor(r.Context(), cfg.dbQueries, id, user.ID); err != nil {
		respondGroupAuthorizationError(w, err)
		return
	}
	files, err := cfg.dbQueries.GetGroupFiles(r.Context(), id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error fetching files", err)
		return
	}

	// Format response with snake_case field names for frontend
	response := make([]map[string]interface{}, len(files))
	for i, file := range files {
		response[i] = map[string]interface{}{
			"id":         file.ID,
			"file_id":    file.ID,
			"filename":   file.Filename,
			"file_size":  file.FileSize,
			"shared_at":  nullTimeToString(file.SharedAt),
			"shared_by":  file.SharedBy,
			"created_at": file.CreatedAt,
			"metadata":   nullStringToString(file.EncryptedMetadata_2),
			"is_owner":   file.OwnerID.Valid && file.OwnerID.UUID == user.ID,
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
	if err := decodeGroupRequest(w, r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if req.FileID == "" {
		respondWithError(w, http.StatusBadRequest, "File ID is required", nil)
		return
	}

	if strings.TrimSpace(req.WrappedKey) == "" {
		respondWithError(w, http.StatusBadRequest, "Wrapped key is required", nil)
		return
	}
	if len(req.WrappedKey) > maxGroupWrappedKey {
		respondWithError(w, http.StatusBadRequest, "Wrapped key is too large", nil)
		return
	}

	fileID, err := parseUUID(req.FileID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error sharing file", err)
		return
	}
	defer tx.Rollback()
	queries := cfg.dbQueries.WithTx(tx)
	if _, err := groupAuthorizationFor(r.Context(), queries, groupID, user.ID); err != nil {
		respondGroupAuthorizationError(w, err)
		return
	}
	file, err := queries.GetFileByID(r.Context(), fileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "File not found", nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "Could not verify file ownership", err)
		}
		return
	}
	if !file.OwnerID.Valid || file.OwnerID.UUID != user.ID {
		respondWithError(w, http.StatusForbidden, "Only the file owner can share it with a group", nil)
		return
	}
	share, err := queries.ShareFileToGroup(r.Context(), database.ShareFileToGroupParams{
		GroupID:    groupID,
		FileID:     fileID,
		WrappedKey: req.WrappedKey,
		CreatedBy:  user.ID,
	})
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			respondWithError(w, http.StatusConflict, "File is already associated with this group", nil)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error sharing file", err)
		return
	}
	if err := recordGroupMutation(r.Context(), queries, r, user.ID, "group.file_shared", "group_file_shared", "file", fileID, map[string]string{"group_id": groupID.String()}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error recording group file association", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error committing group file association", err)
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
	groupIDStr := r.PathValue("id")
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

	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error removing file from group", err)
		return
	}
	defer tx.Rollback()
	queries := cfg.dbQueries.WithTx(tx)
	authz, err := groupAuthorizationFor(r.Context(), queries, groupID, user.ID)
	if err != nil && !errors.Is(err, errGroupForbidden) {
		respondGroupAuthorizationError(w, err)
		return
	}
	var fileOwner uuid.UUID
	if err := tx.QueryRowContext(r.Context(), `SELECT f.owner_id FROM group_file_shares gfs JOIN files f ON f.id=gfs.file_id WHERE gfs.group_id=$1 AND gfs.file_id=$2`, groupID, fileID).Scan(&fileOwner); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "Group file association not found", nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "Could not verify group file association", err)
		}
		return
	}
	if !authz.owner && fileOwner != user.ID {
		respondWithError(w, http.StatusForbidden, "Only the group owner or file owner can remove this association", nil)
		return
	}
	var removed uuid.UUID
	if err := tx.QueryRowContext(r.Context(), `DELETE FROM group_file_shares WHERE group_id=$1 AND file_id=$2 RETURNING id`, groupID, fileID).Scan(&removed); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			respondWithError(w, http.StatusNotFound, "Group file association not found", nil)
		} else {
			respondWithError(w, http.StatusInternalServerError, "Error removing file from group", err)
		}
		return
	}
	if err := recordGroupMutation(r.Context(), queries, r, user.ID, "group.file_removed", "group_file_removed", "file", fileID, map[string]string{"group_id": groupID.String()}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error recording group file removal", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error committing group file removal", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "File removed from group"})
}
