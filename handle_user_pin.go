package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
	"unicode"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
)

func (cfg *ApiConfig) handlerSetUserPIN(w http.ResponseWriter, r *http.Request, user database.User) {
	var req struct {
		PIN                    string `json:"pin"`
		OldPIN                 string `json:"old_pin"`
		PrivateKeyPinEncrypted string `json:"private_key_pin_encrypted"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if !isValidPIN(req.PIN) {
		respondWithError(w, http.StatusBadRequest, "PIN must be exactly 4 digits", nil)
		return
	}

	existing, err := cfg.dbQueries.GetUserByID(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check PIN status", err)
		return
	}

	if isPINLocked(existing) {
		respondWithError(w, http.StatusTooManyRequests, pinLockedMessage(existing), nil)
		return
	}

	if existing.PinHash.Valid && existing.PinHash.String != "" {
		if req.OldPIN == "" {
			respondWithError(w, http.StatusBadRequest, "old_pin required to change existing PIN", nil)
			return
		}
		if err := auth.CheckPasswordHash(req.OldPIN, existing.PinHash.String); err != nil {
			message, lockErr := cfg.registerFailedPINAttempt(r.Context(), existing)
			if lockErr != nil {
				respondWithError(w, http.StatusInternalServerError, "Failed to validate current PIN", lockErr)
				return
			}
			if message == "" {
				message = "Incorrect current PIN"
			}
			respondWithError(w, http.StatusUnauthorized, message, nil)
			return
		}
	}

	if err := cfg.resetPINLockout(r.Context(), user.ID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to reset PIN lockout state", err)
		return
	}

	pinHash, err := auth.HashPassword(req.PIN)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to hash PIN", err)
		return
	}

	now := time.Now().UTC()
	if err := cfg.dbQueries.SetUserPIN(r.Context(), database.SetUserPINParams{
		ID:       user.ID,
		PinHash:  sql.NullString{String: pinHash, Valid: true},
		PinSetAt: sql.NullTime{Time: now, Valid: true},
	}); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to save PIN", err)
		return
	}

	if req.PrivateKeyPinEncrypted != "" {
		if err := cfg.dbQueries.SetPrivateKeyPinEncrypted(r.Context(), database.SetPrivateKeyPinEncryptedParams{
			ID:                     user.ID,
			PrivateKeyPinEncrypted: sql.NullString{String: req.PrivateKeyPinEncrypted, Valid: true},
		}); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to save PIN-encrypted private key", err)
			return
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (cfg *ApiConfig) handlerGetPINStatus(w http.ResponseWriter, r *http.Request, user database.User) {
	status, err := cfg.dbQueries.GetUserPINStatus(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get PIN status", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]bool{
		"pin_set": status.PinHash.Valid && status.PinHash.String != "",
	})
}

func isValidPIN(pin string) bool {
	if len(pin) != 4 {
		return false
	}
	for _, c := range pin {
		if !unicode.IsDigit(c) {
			return false
		}
	}
	return true
}
