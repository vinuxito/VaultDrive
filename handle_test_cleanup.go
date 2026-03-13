package main

import (
	"context"
	"net/http"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) cleanupTestDataHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	// Only allow admin users to cleanup test data
	if !user.IsAdmin.Valid || !user.IsAdmin.Bool {
		respondWithError(w, http.StatusForbidden, "Only admins can cleanup test data", nil)
		return
	}

	ctx := context.Background()
	totalDeleted := 0

	// Delete test files (filename starts with "test_")
	files, err := cfg.dbQueries.GetFilesByOwnerID(ctx, uuid.NullUUID{UUID: user.ID, Valid: true})
	if err == nil {
		for _, file := range files {
			if len(file.Filename) >= 5 && file.Filename[:5] == "test_" {
				err := cfg.dbQueries.DeleteFile(ctx, file.ID)
				if err == nil {
					totalDeleted++
				}
			}
		}
	}

	// Delete test groups (name starts with "test_group_" or "test_share_group_")
	groups, err := cfg.dbQueries.GetGroupsForUser(ctx, user.ID)
	if err == nil {
		for _, group := range groups {
			isTestGroup := (len(group.Name) >= 11 && group.Name[:11] == "test_group_") ||
				(len(group.Name) >= 17 && group.Name[:17] == "test_share_group_")

			if isTestGroup {
				// Delete the group (this will cascade delete members and file shares)
				err := cfg.dbQueries.DeleteGroup(ctx, database.DeleteGroupParams{
					ID:     group.ID,
					UserID: group.UserID,
				})
				if err == nil {
					totalDeleted++
				}
			}
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Test data cleaned up successfully",
		"deleted": totalDeleted,
	})
}
