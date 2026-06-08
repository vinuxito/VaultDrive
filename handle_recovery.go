package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
	"golang.org/x/crypto/bcrypt"
)

type recoveryShareInput struct {
	CustodianID         string `json:"custodian_id"`
	WrappedSharePayload string `json:"wrapped_share_payload"`
}

type saveRecoverySharesPayload struct {
	Threshold int                  `json:"threshold"`
	Shares    []recoveryShareInput `json:"shares"`
}

func (cfg *ApiConfig) handlerSaveRecoveryShares(w http.ResponseWriter, r *http.Request, user database.User) {
	var payload saveRecoverySharesPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	if payload.Threshold < 1 || payload.Threshold > len(payload.Shares) {
		respondWithError(w, http.StatusBadRequest, "Invalid threshold value", nil)
		return
	}

	// Delete existing shares first
	err := cfg.dbQueries.DeleteRecoverySharesForUser(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete existing recovery shares", err)
		return
	}

	// Update user's recovery threshold
	err = cfg.dbQueries.UpdateUserRecoveryThreshold(r.Context(), database.UpdateUserRecoveryThresholdParams{
		ID:                user.ID,
		RecoveryThreshold: int32(payload.Threshold),
		UpdatedAt:         time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update recovery threshold", err)
		return
	}

	// Create new shares
	for _, s := range payload.Shares {
		custodianID, err := uuid.Parse(s.CustodianID)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "Invalid custodian ID format", err)
			return
		}

		_, err = cfg.dbQueries.CreateOrUpdateRecoveryShare(r.Context(), database.CreateOrUpdateRecoveryShareParams{
			UserID:              user.ID,
			CustodianID:         custodianID,
			WrappedSharePayload: s.WrappedSharePayload,
			Status:              "pending",
			CreatedAt:           time.Now(),
			UpdatedAt:           time.Now(),
		})
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to save recovery share", err)
			return
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Recovery shares saved successfully"})
}

type startRecoveryPayload struct {
	Username string `json:"username"`
}

func (cfg *ApiConfig) handlerStartRecoveryRequest(w http.ResponseWriter, r *http.Request) {
	var payload startRecoveryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	owner, err := cfg.dbQueries.GetUserByUsername(r.Context(), payload.Username)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "User not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to check user status", err)
		return
	}

	// Reset recovery request shares to pending and clear decrypted parts
	err = cfg.dbQueries.StartRecoveryRequestForUser(r.Context(), database.StartRecoveryRequestForUserParams{
		UserID:    owner.ID,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to start recovery request", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Recovery request started successfully"})
}

func (cfg *ApiConfig) handlerGetRecoveryRequests(w http.ResponseWriter, r *http.Request, user database.User) {
	requests, err := cfg.dbQueries.GetRecoveryRequestsForCustodian(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve recovery requests", err)
		return
	}

	response := make([]map[string]interface{}, len(requests))
	for i, req := range requests {
		response[i] = map[string]interface{}{
			"id":                    req.ID,
			"owner_id":              req.UserID,
			"owner_username":        req.OwnerUsername,
			"owner_email":           req.OwnerEmail,
			"owner_first_name":      req.OwnerFirstName,
			"owner_last_name":       req.OwnerLastName,
			"wrapped_share_payload": req.WrappedSharePayload,
			"status":                req.Status,
			"created_at":            req.CreatedAt,
		}
	}

	respondWithJSON(w, http.StatusOK, response)
}

type approveRecoveryPayload struct {
	OwnerID            string `json:"owner_id"`
	DecryptedSharePart string `json:"decrypted_share_part"`
}

func (cfg *ApiConfig) handlerApproveRecoveryShare(w http.ResponseWriter, r *http.Request, user database.User) {
	var payload approveRecoveryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	ownerID, err := uuid.Parse(payload.OwnerID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid owner ID format", err)
		return
	}

	_, err = cfg.dbQueries.ApproveRecoveryShare(r.Context(), database.ApproveRecoveryShareParams{
		UserID:             ownerID,
		CustodianID:        user.ID,
		DecryptedSharePart: sql.NullString{String: payload.DecryptedSharePart, Valid: true},
		UpdatedAt:          time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to approve recovery share", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Recovery share approved successfully"})
}

func (cfg *ApiConfig) handlerGetRecoveryStatus(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")
	if username == "" {
		respondWithError(w, http.StatusBadRequest, "Username parameter is required", nil)
		return
	}

	owner, err := cfg.dbQueries.GetUserByUsername(r.Context(), username)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "User not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve user info", err)
		return
	}

	shares, err := cfg.dbQueries.GetRecoverySharesForUserWithCustodian(r.Context(), owner.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve recovery shares", err)
		return
	}

	sharesList := make([]map[string]interface{}, len(shares))
	for i, s := range shares {
		decryptedPart := ""
		if s.DecryptedSharePart.Valid {
			decryptedPart = s.DecryptedSharePart.String
		}

		sharesList[i] = map[string]interface{}{
			"custodian_id":         s.CustodianID,
			"custodian_username":   s.CustodianUsername,
			"custodian_email":      s.CustodianEmail,
			"custodian_first_name": s.CustodianFirstName,
			"custodian_last_name":  s.CustodianLastName,
			"status":               s.Status,
			"decrypted_share_part": decryptedPart,
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"username":  owner.Username,
		"threshold": owner.RecoveryThreshold,
		"shares":    sharesList,
	})
}

type resetRecoveryPasswordPayload struct {
	Username               string `json:"username"`
	NewPasswordHash        string `json:"new_password_hash"`
	NewPrivateKeyEncrypted string `json:"new_private_key_encrypted"`
}

func (cfg *ApiConfig) handlerResetRecoveryPassword(w http.ResponseWriter, r *http.Request) {
	var payload resetRecoveryPasswordPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	owner, err := cfg.dbQueries.GetUserByUsername(r.Context(), payload.Username)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "User not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to retrieve user info", err)
		return
	}

	if owner.RecoveryThreshold <= 0 {
		respondWithError(w, http.StatusForbidden, "Account recovery is not configured for this user", nil)
		return
	}

	shares, err := cfg.dbQueries.GetRecoverySharesForUser(r.Context(), owner.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to check recovery shares status", err)
		return
	}

	approvedCount := 0
	for _, s := range shares {
		if s.Status == "approved" && s.DecryptedSharePart.Valid && s.DecryptedSharePart.String != "" {
			approvedCount++
		}
	}

	if approvedCount < int(owner.RecoveryThreshold) {
		respondWithError(w, http.StatusForbidden, "Insufficient custodian approvals", errors.New("threshold not met"))
		return
	}

	// Hash password with bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(payload.NewPasswordHash), bcrypt.DefaultCost)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to hash password", err)
		return
	}

	// Execute updates
	err = cfg.dbQueries.UpdateUserPassword(r.Context(), database.UpdateUserPasswordParams{
		ID:           owner.ID,
		PasswordHash: string(hashedPassword),
		UpdatedAt:    time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update password", err)
		return
	}

	err = cfg.dbQueries.UpdateUserKEK(r.Context(), database.UpdateUserKEKParams{
		ID:                  owner.ID,
		PrivateKeyEncrypted: payload.NewPrivateKeyEncrypted,
		KekEnvelopeVersion:  1, // Reset KEK version back to 1
		UpdatedAt:           time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update private key", err)
		return
	}

	// Reset PIN configurations (since password changed, old PIN encryption is invalid)
	err = cfg.dbQueries.ResetUserPINAsAdmin(r.Context(), database.ResetUserPINAsAdminParams{
		ID:        owner.ID,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to reset PIN configurations", err)
		return
	}

	// Clean up/delete recovery shares after successful recovery to prevent replay attacks
	err = cfg.dbQueries.DeleteRecoverySharesForUser(r.Context(), owner.ID)
	if err != nil {
		// Log error but don't fail request since the user has recovered successfully
		log.Printf("Error deleting recovery shares after recovery: %v", err)
	}

	// Audit log insertion
	cfg.insertAudit(r.Context(), owner.ID, "user.recovered", "user", &owner.ID, "Account successfully recovered via custodian consensus", r)

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Account successfully recovered. Please log in with your new password."})
}
