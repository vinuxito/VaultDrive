package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

type EmailAccountResponse struct {
	ID                    string `json:"id"`
	UserID                string `json:"userId"`
	Email                 string `json:"email"`
	ImapHost              string `json:"imapHost"`
	ImapPort              int32  `json:"imapPort"`
	ImapUser              string `json:"imapUser"`
	EncryptedImapPassword []byte `json:"-"`
	CreatedAt             string `json:"createdAt"`
	UpdatedAt             string `json:"updatedAt"`
}

func toEmailAccountResponse(account database.EmailAccount) EmailAccountResponse {
	return EmailAccountResponse{
		ID:                    account.ID.String(),
		UserID:                account.UserID.String(),
		Email:                 account.Email,
		ImapHost:              account.ImapHost,
		ImapPort:              account.ImapPort,
		ImapUser:              account.ImapUser,
		EncryptedImapPassword: account.EncryptedImapPassword,
		CreatedAt:             account.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:             account.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}

func (cfg *ApiConfig) handleCreateEmailAccount(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		Email    string `json:"email"`
		ImapHost string `json:"imap_host"`
		ImapPort int32  `json:"imap_port"`
		ImapUser string `json:"imap_user"`
		Password string `json:"password"`
	}
	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	if err := decoder.Decode(&params); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	userID, err := cfg.getUserIDFromRequest(r)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	encryptedPasswordStr, err := auth.EncryptPassword(params.Password, cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to encrypt password", err)
		return
	}
	encryptedPassword := []byte(encryptedPasswordStr)

	account, err := cfg.dbQueries.CreateEmailAccount(r.Context(), database.CreateEmailAccountParams{
		UserID:                userID,
		Email:                 params.Email,
		ImapHost:              params.ImapHost,
		ImapPort:              params.ImapPort,
		ImapUser:              params.ImapUser,
		EncryptedImapPassword: encryptedPassword,
	})
	if err != nil {
		// Check if duplicate key error
		if strings.Contains(err.Error(), "duplicate key") && strings.Contains(err.Error(), "email_accounts_email_key") {
			respondWithError(w, http.StatusConflict, "Email account already exists", nil)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to create email account", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, toEmailAccountResponse(account))
}

func (cfg *ApiConfig) handleGetEmailAccount(w http.ResponseWriter, r *http.Request) {
	accountID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid account ID", err)
		return
	}

	userID, err := cfg.getUserIDFromRequest(r)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	account, err := cfg.dbQueries.GetEmailAccountByID(r.Context(), database.GetEmailAccountByIDParams{
		ID:     accountID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Email account not found", err)
		return
	}

	respondWithJSON(w, http.StatusOK, toEmailAccountResponse(account))
}

func (cfg *ApiConfig) handleListEmailAccounts(w http.ResponseWriter, r *http.Request) {
	userID, err := cfg.getUserIDFromRequest(r)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	accounts, err := cfg.dbQueries.ListEmailAccountsByUser(r.Context(), userID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list email accounts", err)
		return
	}

	// Transform to response format with lowercase JSON keys
	ResponseAccounts := []EmailAccountResponse{}
	for _, acc := range accounts {
		ResponseAccounts = append(ResponseAccounts, toEmailAccountResponse(acc))
	}

	respondWithJSON(w, http.StatusOK, ResponseAccounts)
}

func (cfg *ApiConfig) handleUpdateEmailAccount(w http.ResponseWriter, r *http.Request) {
	accountID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid account ID", err)
		return
	}

	type parameters struct {
		Email    string `json:"email"`
		ImapHost string `json:"imap_host"`
		ImapPort int32  `json:"imap_port"`
		ImapUser string `json:"imap_user"`
		Password string `json:"password"`
	}
	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	if err := decoder.Decode(&params); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	userID, err := cfg.getUserIDFromRequest(r)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	// Get existing account to preserve password if not provided
	existingAccount, err := cfg.dbQueries.GetEmailAccountByID(r.Context(), database.GetEmailAccountByIDParams{
		ID:     accountID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Email account not found", err)
		return
	}

	// Use existing encrypted password if no new password provided
	encryptedPassword := existingAccount.EncryptedImapPassword
	if params.Password != "" {
		encryptedPasswordStr, err := auth.EncryptPassword(params.Password, cfg.jwtSecret)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to encrypt password", err)
			return
		}
		encryptedPassword = []byte(encryptedPasswordStr)
	}

	account, err := cfg.dbQueries.UpdateEmailAccount(r.Context(), database.UpdateEmailAccountParams{
		ID:                    accountID,
		UserID:                userID,
		Email:                 params.Email,
		ImapHost:              params.ImapHost,
		ImapPort:              params.ImapPort,
		ImapUser:              params.ImapUser,
		EncryptedImapPassword: encryptedPassword,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update email account", err)
		return
	}

	respondWithJSON(w, http.StatusOK, toEmailAccountResponse(account))
}

func (cfg *ApiConfig) handleDeleteEmailAccount(w http.ResponseWriter, r *http.Request) {
	accountID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid account ID", err)
		return
	}

	userID, err := cfg.getUserIDFromRequest(r)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized", err)
		return
	}

	err = cfg.dbQueries.DeleteEmailAccount(r.Context(), database.DeleteEmailAccountParams{
		ID:     accountID,
		UserID: userID,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete email account", err)
		return
	}

	respondWithJSON(w, http.StatusOK, struct{}{})
}

func (cfg *ApiConfig) getUserIDFromRequest(r *http.Request) (uuid.UUID, error) {
	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		return uuid.Nil, err
	}

	userID, err := auth.ValidateJWT(token, cfg.jwtSecret)
	if err != nil {
		return uuid.Nil, err
	}

	return userID, nil
}
