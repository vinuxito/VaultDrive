package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"golang.org/x/crypto/bcrypt"
)

// POST /api/users/change-password — User changes their own password.
// Works for both voluntary changes and forced changes.
// Requires: old_password + new_password. Clears force_password_change flag.
// Note: private key re-encryption with the new password happens browser-side.
func (cfg *ApiConfig) handleChangePassword(w http.ResponseWriter, r *http.Request, user database.User) {
	type request struct {
		OldPassword         string `json:"old_password"`
		NewPassword         string `json:"new_password"`
		PrivateKeyEncrypted string `json:"private_key_encrypted,omitempty"`
	}

	var req request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if req.OldPassword == "" || req.NewPassword == "" {
		respondWithError(w, http.StatusBadRequest, "Both old_password and new_password are required", nil)
		return
	}

	if len(req.NewPassword) < 8 {
		respondWithError(w, http.StatusBadRequest, "New password must be at least 8 characters", nil)
		return
	}

	// Verify old password matches
	if err := auth.CheckPasswordHash(req.OldPassword, user.PasswordHash); err != nil {
		respondWithError(w, http.StatusUnauthorized, "Current password is incorrect", err)
		return
	}

	// Ensure new password differs from old
	if req.OldPassword == req.NewPassword {
		respondWithError(w, http.StatusBadRequest, "New password must be different from current password", nil)
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error hashing password", err)
		return
	}

	now := time.Now()

	// Update password
	err = cfg.dbQueries.UpdateUserPassword(context.Background(), database.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: string(hashedPassword),
		UpdatedAt:    now,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error updating password", err)
		return
	}

	// Save re-encrypted private key if provided (browser-side re-encryption)
	if req.PrivateKeyEncrypted != "" {
		err = cfg.dbQueries.UpdateUserPrivateKeyEncrypted(context.Background(), database.UpdateUserPrivateKeyEncryptedParams{
			ID:                  user.ID,
			PrivateKeyEncrypted: req.PrivateKeyEncrypted,
			UpdatedAt:           now,
		})
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Error updating encrypted private key", err)
			return
		}
	}

	// Clear force_password_change flag
	err = cfg.dbQueries.ClearForcePasswordChange(context.Background(), database.ClearForcePasswordChangeParams{
		ID:        user.ID,
		UpdatedAt: now,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error clearing password change flag", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}
