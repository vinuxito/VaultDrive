package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"unicode"

	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func (cfg *ApiConfig) handlerSetUserPIN(w http.ResponseWriter, r *http.Request, user database.User) {
	var req struct {
		PIN                    string `json:"pin"`
		OldPIN                 string `json:"old_pin"`
		PrivateKeyPinEncrypted string `json:"private_key_pin_encrypted"`
		PrivateKeyEncrypted    string `json:"private_key_encrypted,omitempty"`
		KekEnvelopeVersion     *int32 `json:"kek_envelope_version,omitempty"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024*1024)).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if !isValidPIN(req.PIN) {
		respondWithError(w, http.StatusBadRequest, "PIN must be exactly 4 digits", nil)
		return
	}
	if len(req.PrivateKeyPinEncrypted) < 32 || len(req.PrivateKeyPinEncrypted) > 512*1024 {
		respondWithError(w, http.StatusBadRequest, "A valid encrypted PIN key is required", nil)
		return
	}
	if req.KekEnvelopeVersion == nil || (*req.KekEnvelopeVersion != 1 && *req.KekEnvelopeVersion != 2) {
		respondWithError(w, http.StatusBadRequest, "A valid key envelope version is required", nil)
		return
	}
	if req.PrivateKeyEncrypted != "" && (len(req.PrivateKeyEncrypted) < 32 || len(req.PrivateKeyEncrypted) > 512*1024) {
		respondWithError(w, http.StatusBadRequest, "Invalid repaired password key envelope", nil)
		return
	}

	pinHash, err := auth.HashPassword(req.PIN)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to hash PIN", err)
		return
	}

	mutation := setPINMutation{
		PINHash: pinHash, OldPIN: req.OldPIN,
		PrivateKeyPinEncrypted: req.PrivateKeyPinEncrypted,
		PrivateKeyEncrypted:    req.PrivateKeyEncrypted,
	}
	mutation.KekEnvelopeVersion = *req.KekEnvelopeVersion
	mutation.HasKekEnvelopeVersion = true
	if err := cfg.setPINAtomically(r.Context(), user.ID, mutation, r); err != nil {
		switch {
		case errors.Is(err, errIncorrectPIN):
			respondWithError(w, http.StatusUnauthorized, "Incorrect current PIN", nil)
		case errors.Is(err, errPINLocked):
			respondWithError(w, http.StatusTooManyRequests, "Too many incorrect PIN attempts. Try again later.", nil)
		default:
			respondWithError(w, http.StatusInternalServerError, "PIN and encrypted key were not saved", err)
		}
		return
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
