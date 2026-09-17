package main

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
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
		KekEnvelopeVersion  int32  `json:"kek_envelope_version"`
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

	// Early feedback only. The transactional helper locks and verifies the fresh row again.
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

	err = cfg.changePasswordAtomically(r.Context(), user.ID, req.OldPassword,
		string(hashedPassword), req.PrivateKeyEncrypted, req.KekEnvelopeVersion, r)
	if err != nil {
		if errors.Is(err, errCredentialChanged) {
			respondWithError(w, http.StatusConflict, "Your credentials changed. Sign in again before retrying.", err)
			return
		}
		if req.PrivateKeyEncrypted == "" {
			respondWithError(w, http.StatusBadRequest, "The encrypted account key is required. No password change was saved.", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Password change could not be saved atomically", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}
