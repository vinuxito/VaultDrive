package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handleListMailboxes(w http.ResponseWriter, r *http.Request) {
	accountID := r.PathValue("id")

	account, err := cfg.getEmailAccount(r, accountID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Email account not found", err)
		return
	}

	encryptedPwd := string(account.EncryptedImapPassword)
	log.Printf("Decrypting password (length: %d)", len(encryptedPwd))

	password, err := auth.DecryptPassword(encryptedPwd, cfg.jwtSecret)
	if err != nil {
		log.Printf("Password decryption failed: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to decrypt password", err)
		return
	}

	log.Printf("Password decrypted (length: %d)", len(password))

	client, err := connectToIMAP(account.ImapHost, int(account.ImapPort), account.ImapUser, password)
	if err != nil {
		log.Printf("IMAP connection failed: %v", err)
		respondWithError(w, http.StatusInternalServerError, "IMAP connection failed", err)
		return
	}
	defer client.CloseConnection()

	mailboxes, err := client.ListMailboxes()
	if err != nil {
		log.Printf("List mailboxes failed: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to list mailboxes", err)
		return
	}

	respondWithJSON(w, http.StatusOK, mailboxes)
}

func (cfg *ApiConfig) handleListEmails(w http.ResponseWriter, r *http.Request) {
	accountID := r.PathValue("id")
	mailboxName := r.PathValue("mailbox")

	account, err := cfg.getEmailAccount(r, accountID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Email account not found", err)
		return
	}

	password, err := auth.DecryptPassword(string(account.EncryptedImapPassword), cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to decrypt password", err)
		return
	}

	count := 10
	type countParams struct {
		Count int `json:"count,omitempty"`
	}
	params := countParams{}
	if err := json.NewDecoder(r.Body).Decode(&params); err == nil && params.Count > 0 {
		count = params.Count
	}

	client, err := connectToIMAP(account.ImapHost, int(account.ImapPort), account.ImapUser, password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "IMAP connection failed", err)
		return
	}
	defer client.CloseConnection()

	if mailboxName == "" {
		mailboxName = "INBOX"
	}

	emails, err := client.FetchRecentMessages(mailboxName, count)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch emails", err)
		return
	}

	respondWithJSON(w, http.StatusOK, emails)
}

func (cfg *ApiConfig) handleGetEmail(w http.ResponseWriter, r *http.Request) {
	accountID := r.PathValue("id")
	emailID := r.PathValue("uid")

	account, err := cfg.getEmailAccount(r, accountID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Email account not found", err)
		return
	}

	password, err := auth.DecryptPassword(string(account.EncryptedImapPassword), cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to decrypt password", err)
		return
	}

	client, err := connectToIMAP(account.ImapHost, int(account.ImapPort), account.ImapUser, password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "IMAP connection failed", err)
		return
	}
	defer client.CloseConnection()

	mailboxName := r.PathValue("mailbox")
	if mailboxName == "" {
		mailboxName = "INBOX"
	}

	emails, err := client.FetchRecentMessages(mailboxName, 1)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch emails", err)
		return
	}

	for _, email := range emails {
		if fmt.Sprint(email.UID) == emailID {
			respondWithJSON(w, http.StatusOK, email)
			return
		}
	}

	respondWithError(w, http.StatusNotFound, "Email not found", nil)
}

func (cfg *ApiConfig) getEmailAccount(r *http.Request, accountID string) (EmailAccountResult, error) {
	accountUUID, err := parseUUID(accountID)
	if err != nil {
		return EmailAccountResult{}, err
	}

	userID, err := cfg.getUserIDFromRequest(r)
	if err != nil {
		return EmailAccountResult{}, err
	}

	dbAccount, err := cfg.dbQueries.GetEmailAccountByID(r.Context(), database.GetEmailAccountByIDParams{
		ID:     accountUUID,
		UserID: userID,
	})
	if err != nil {
		return EmailAccountResult{}, err
	}

	return EmailAccountResult{
		ID:                    dbAccount.ID,
		UserID:                dbAccount.UserID,
		Email:                 dbAccount.Email,
		ImapHost:              dbAccount.ImapHost,
		ImapPort:              dbAccount.ImapPort,
		ImapUser:              dbAccount.ImapUser,
		EncryptedImapPassword: dbAccount.EncryptedImapPassword,
		CreatedAt:             dbAccount.CreatedAt,
		UpdatedAt:             dbAccount.UpdatedAt,
	}, nil
}

type EmailAccountResult struct {
	ID                    uuid.UUID
	UserID                uuid.UUID
	Email                 string
	ImapHost              string
	ImapPort              int32
	ImapUser              string
	EncryptedImapPassword []byte
	CreatedAt             time.Time
	UpdatedAt             time.Time
}
