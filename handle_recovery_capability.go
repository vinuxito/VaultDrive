package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
	"golang.org/x/crypto/bcrypt"
)

const (
	maxRecoveryCustodians          = 10
	maxRecoveryWrappedPayloadBytes = 128 * 1024
	maxRecoverySharePartBytes      = 128 * 1024
	recoveryAttemptLifetime        = 24 * time.Hour
)

type recoveryShareInput struct {
	CustodianID         string `json:"custodian_id"`
	WrappedSharePayload string `json:"wrapped_share_payload"`
}
type saveRecoverySharesPayload struct {
	Threshold int                  `json:"threshold"`
	Shares    []recoveryShareInput `json:"shares"`
}
type startRecoveryPayload struct {
	Username string `json:"username"`
}

var (
	recoveryRequestRateLimiter    = newSlidingWindow()
	recoveryIPRateLimiter         = newSlidingWindow()
	recoveryCapabilityRateLimiter = newSlidingWindow()
)

func allowRecoveryRequest(r *http.Request, key string, limit int, window time.Duration) bool {
	ip := requestIP(r)
	if isLoopbackIP(ip) {
		return true
	}
	action, _, _ := strings.Cut(key, ":")
	if !recoveryIPRateLimiter.allow(ip+":"+action, limit*10, window) {
		return false
	}
	return recoveryCapabilityRateLimiter.allow(ip+":"+key, limit, window)
}

type validatedRecoveryShare struct {
	CustodianID         uuid.UUID
	WrappedSharePayload string
}

func validateRecoveryConfiguration(ownerID uuid.UUID, payload saveRecoverySharesPayload) ([]validatedRecoveryShare, error) {
	if len(payload.Shares) == 0 || len(payload.Shares) > maxRecoveryCustodians {
		return nil, fmt.Errorf("recovery requires between 1 and %d custodians", maxRecoveryCustodians)
	}
	if payload.Threshold < 1 || payload.Threshold > len(payload.Shares) {
		return nil, errors.New("invalid recovery threshold")
	}
	seen := make(map[uuid.UUID]struct{}, len(payload.Shares))
	result := make([]validatedRecoveryShare, 0, len(payload.Shares))
	for _, share := range payload.Shares {
		id, err := uuid.Parse(strings.TrimSpace(share.CustodianID))
		if err != nil {
			return nil, errors.New("invalid custodian ID")
		}
		if id == ownerID {
			return nil, errors.New("account owner cannot be a recovery custodian")
		}
		if _, ok := seen[id]; ok {
			return nil, errors.New("recovery custodians must be unique")
		}
		if len(share.WrappedSharePayload) == 0 || len(share.WrappedSharePayload) > maxRecoveryWrappedPayloadBytes {
			return nil, errors.New("wrapped recovery share is missing or too large")
		}
		seen[id] = struct{}{}
		result = append(result, validatedRecoveryShare{id, share.WrappedSharePayload})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].CustodianID.String() < result[j].CustodianID.String() })
	return result, nil
}

func randomRecoveryToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func hashRecoveryCapability(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
func newRecoveryCapability() (string, string, error) {
	raw, err := randomRecoveryToken(32)
	if err != nil {
		return "", "", err
	}
	return raw, hashRecoveryCapability(raw), nil
}
func recoveryCapabilityFromRequest(r *http.Request) (string, error) {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(header, "Bearer ") {
		return "", errors.New("recovery capability required")
	}
	raw := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || len(decoded) != 32 || strings.Contains(raw, ".") {
		return "", errors.New("invalid recovery capability")
	}
	return raw, nil
}
func setRecoveryNoStoreHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
}
func expireRecoveryAttemptsForOwner(ctx context.Context, tx *sql.Tx, ownerID uuid.UUID) error {
	_, err := tx.ExecContext(ctx, `WITH expired AS (UPDATE account_recovery_attempts SET status='expired',updated_at=NOW() WHERE user_id=$1 AND status='active' AND expires_at<=NOW() RETURNING id) DELETE FROM account_recovery_attempt_approvals a USING expired e WHERE a.attempt_id=e.id`, ownerID)
	return err
}
func expireRecoveryAttemptByCapability(ctx context.Context, tx *sql.Tx, capabilityHash string) error {
	_, err := tx.ExecContext(ctx, `WITH expired AS (UPDATE account_recovery_attempts SET status='expired',updated_at=NOW() WHERE capability_hash=$1 AND status='active' AND expires_at<=NOW() RETURNING id) DELETE FROM account_recovery_attempt_approvals a USING expired e WHERE a.attempt_id=e.id`, capabilityHash)
	return err
}
func expireRecoveryAttemptByID(ctx context.Context, tx *sql.Tx, attemptID uuid.UUID) error {
	_, err := tx.ExecContext(ctx, `WITH expired AS (UPDATE account_recovery_attempts SET status='expired',updated_at=NOW() WHERE id=$1 AND status='active' AND expires_at<=NOW() RETURNING id) DELETE FROM account_recovery_attempt_approvals a USING expired e WHERE a.attempt_id=e.id`, attemptID)
	return err
}
func expireRecoveryAttemptsForCustodian(ctx context.Context, tx *sql.Tx, custodianID uuid.UUID) error {
	_, err := tx.ExecContext(ctx, `WITH expired AS (UPDATE account_recovery_attempts SET status='expired',updated_at=NOW() WHERE id IN(SELECT attempt_id FROM account_recovery_attempt_approvals WHERE custodian_id=$1) AND status='active' AND expires_at<=NOW() RETURNING id) DELETE FROM account_recovery_attempt_approvals a USING expired e WHERE a.attempt_id=e.id`, custodianID)
	return err
}

func (cfg *ApiConfig) handlerSaveRecoverySharesV2(w http.ResponseWriter, r *http.Request, user database.User) {
	var payload saveRecoverySharesPayload
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2*maxRecoveryWrappedPayloadBytes)).Decode(&payload); err != nil {
		respondWithError(w, 400, "Invalid recovery configuration", err)
		return
	}
	shares, err := validateRecoveryConfiguration(user.ID, payload)
	if err != nil {
		respondWithError(w, 400, err.Error(), nil)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		respondWithError(w, 500, "Failed to save recovery configuration", err)
		return
	}
	defer tx.Rollback()
	var exists bool
	if err := tx.QueryRowContext(r.Context(), `SELECT TRUE FROM users WHERE id=$1 FOR UPDATE`, user.ID).Scan(&exists); err != nil {
		respondWithError(w, 409, "Account changed. Sign in again.", err)
		return
	}
	for _, share := range shares {
		if err := tx.QueryRowContext(r.Context(), `SELECT TRUE FROM users WHERE id=$1`, share.CustodianID).Scan(&exists); err != nil {
			respondWithError(w, 400, "A selected custodian is unavailable", err)
			return
		}
	}
	if _, err := tx.ExecContext(r.Context(), `DELETE FROM account_recovery_attempt_approvals WHERE attempt_id IN(SELECT id FROM account_recovery_attempts WHERE user_id=$1 AND status='active')`, user.ID); err != nil {
		respondWithError(w, 500, "Failed to invalidate active recovery attempts", err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE account_recovery_attempts SET status='cancelled',updated_at=NOW() WHERE user_id=$1 AND status='active'`, user.ID); err != nil {
		respondWithError(w, 500, "Failed to invalidate active recovery attempts", err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `DELETE FROM account_recovery_shares WHERE user_id=$1`, user.ID); err != nil {
		respondWithError(w, 500, "Failed to replace recovery configuration", err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE users SET recovery_threshold=$2,updated_at=NOW() WHERE id=$1`, user.ID, payload.Threshold); err != nil {
		respondWithError(w, 500, "Failed to save recovery threshold", err)
		return
	}
	for _, share := range shares {
		if _, err := tx.ExecContext(r.Context(), `INSERT INTO account_recovery_shares(user_id,custodian_id,wrapped_share_payload,status,decrypted_share_part,created_at,updated_at)VALUES($1,$2,$3,'configured',NULL,NOW(),NOW())`, user.ID, share.CustodianID, share.WrappedSharePayload); err != nil {
			respondWithError(w, 500, "Failed to save recovery custodian", err)
			return
		}
	}
	if err := insertAuditTx(r.Context(), tx, user.ID, "recovery.configuration_updated", map[string]interface{}{"custodian_count": len(shares), "threshold": payload.Threshold}, r); err != nil {
		respondWithError(w, 500, "Failed to audit recovery configuration", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, 500, "Failed to save recovery configuration", err)
		return
	}
	respondWithJSON(w, 200, map[string]string{"message": "Recovery configuration saved"})
}

func (cfg *ApiConfig) handlerGetRecoveryConfigV2(w http.ResponseWriter, r *http.Request, user database.User) {
	rows, err := cfg.db.QueryContext(r.Context(), `SELECT s.custodian_id,u.username,u.first_name,u.last_name FROM account_recovery_shares s JOIN users u ON u.id=s.custodian_id WHERE s.user_id=$1 ORDER BY s.custodian_id`, user.ID)
	if err != nil {
		respondWithError(w, 500, "Failed to load recovery configuration", err)
		return
	}
	defer rows.Close()
	shares := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id uuid.UUID
		var username, first, last string
		if err := rows.Scan(&id, &username, &first, &last); err != nil {
			respondWithError(w, 500, "Failed to load recovery configuration", err)
			return
		}
		shares = append(shares, map[string]interface{}{"custodian_id": id, "custodian_username": username, "custodian_first_name": first, "custodian_last_name": last, "status": "configured"})
	}
	if err := rows.Err(); err != nil {
		respondWithError(w, 500, "Failed to load recovery configuration", err)
		return
	}
	var threshold int
	if err := cfg.db.QueryRowContext(r.Context(), `SELECT recovery_threshold FROM users WHERE id=$1`, user.ID).Scan(&threshold); err != nil {
		respondWithError(w, 500, "Failed to load recovery threshold", err)
		return
	}
	respondWithJSON(w, 200, map[string]interface{}{"threshold": threshold, "shares": shares})
}

func (cfg *ApiConfig) handlerStartRecoveryRequestV2(w http.ResponseWriter, r *http.Request) {
	setRecoveryNoStoreHeaders(w)
	var payload startRecoveryPayload
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&payload); err != nil || len(strings.TrimSpace(payload.Username)) > 255 {
		respondWithError(w, 400, "Invalid recovery request", err)
		return
	}
	normalizedUsername := strings.ToLower(strings.TrimSpace(payload.Username))
	if !isLoopbackIP(requestIP(r)) && (!recoveryRequestRateLimiter.allow("ip:"+requestIP(r), 5, time.Hour) || !recoveryRequestRateLimiter.allow("account:"+hashRecoveryCapability(normalizedUsername), 3, time.Hour)) {
		w.Header().Set("Retry-After", "3600")
		respondWithError(w, http.StatusTooManyRequests, "Too many recovery requests. Try again later.", nil)
		return
	}
	raw, tokenHash, err := newRecoveryCapability()
	if err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	codeBytes := make([]byte, 4)
	if _, err := rand.Read(codeBytes); err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	code := strings.ToUpper(hex.EncodeToString(codeBytes))
	expires := time.Now().UTC().Add(recoveryAttemptLifetime)
	response := map[string]interface{}{"recovery_token": raw, "verification_code": code, "expires_at": expires}
	tx, err := cfg.db.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	defer tx.Rollback()
	var ownerID uuid.UUID
	var threshold int
	err = tx.QueryRowContext(r.Context(), `SELECT id,recovery_threshold FROM users WHERE LOWER(username)=LOWER($1) FOR UPDATE`, strings.TrimSpace(payload.Username)).Scan(&ownerID, &threshold)
	if errors.Is(err, sql.ErrNoRows) {
		_ = tx.Rollback()
		respondWithJSON(w, 202, response)
		return
	}
	if err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	if err := expireRecoveryAttemptsForOwner(r.Context(), tx, ownerID); err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	var active bool
	if err := tx.QueryRowContext(r.Context(), `SELECT EXISTS(SELECT 1 FROM account_recovery_attempts WHERE user_id=$1 AND status='active' AND expires_at>NOW())`, ownerID).Scan(&active); err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	rows, err := tx.QueryContext(r.Context(), `SELECT id,custodian_id FROM account_recovery_shares WHERE user_id=$1 ORDER BY custodian_id`, ownerID)
	if err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	type configuredShare struct{ ID, CustodianID uuid.UUID }
	configured := make([]configuredShare, 0)
	for rows.Next() {
		var s configuredShare
		if err := rows.Scan(&s.ID, &s.CustodianID); err != nil {
			rows.Close()
			respondWithError(w, 500, "Recovery request could not be started", err)
			return
		}
		configured = append(configured, s)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	rows.Close()
	if active {
		respondWithError(w, http.StatusConflict, "A recovery request is already active. Continue it in the browser where it was started or wait for it to expire.", nil)
		return
	}
	if threshold < 1 || threshold > len(configured) {
		_ = tx.Rollback()
		respondWithJSON(w, 202, response)
		return
	}
	attemptID := uuid.New()
	if _, err := tx.ExecContext(r.Context(), `INSERT INTO account_recovery_attempts(id,user_id,capability_hash,verification_code,threshold,status,expires_at,created_at,updated_at)VALUES($1,$2,$3,$4,$5,'active',$6,NOW(),NOW())`, attemptID, ownerID, tokenHash, code, threshold, expires); err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	for i, s := range configured {
		challenge, err := randomRecoveryToken(24)
		if err != nil {
			respondWithError(w, 500, "Recovery request could not be started", err)
			return
		}
		if _, err := tx.ExecContext(r.Context(), `INSERT INTO account_recovery_attempt_approvals(attempt_id,recovery_share_id,custodian_id,share_index,challenge,status,created_at,updated_at)VALUES($1,$2,$3,$4,$5,'pending',NOW(),NOW())`, attemptID, s.ID, s.CustodianID, i+1, challenge); err != nil {
			respondWithError(w, 500, "Recovery request could not be started", err)
			return
		}
	}
	if err := insertAuditTx(r.Context(), tx, ownerID, "recovery.requested", map[string]interface{}{"attempt_id": attemptID, "expires_at": expires}, r); err != nil {
		respondWithError(w, 500, "Recovery request could not be audited", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, 500, "Recovery request could not be started", err)
		return
	}
	respondWithJSON(w, 202, response)
}

func (cfg *ApiConfig) handlerGetRecoveryRequestsV2(w http.ResponseWriter, r *http.Request, user database.User) {
	if !allowRecoveryRequest(r, "custodian-requests:"+user.ID.String(), 60, time.Minute) {
		w.Header().Set("Retry-After", "60")
		respondWithError(w, 429, "Too many recovery checks. Try again shortly.", nil)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, 500, "Failed to retrieve recovery requests", err)
		return
	}
	defer tx.Rollback()
	if err := expireRecoveryAttemptsForCustodian(r.Context(), tx, user.ID); err != nil {
		respondWithError(w, 500, "Failed to expire recovery requests", err)
		return
	}
	rows, err := tx.QueryContext(r.Context(), `SELECT a.id,a.attempt_id,a.challenge,r.verification_code,r.expires_at,u.username,u.first_name,u.last_name,s.wrapped_share_payload FROM account_recovery_attempt_approvals a JOIN account_recovery_attempts r ON r.id=a.attempt_id JOIN account_recovery_shares s ON s.id=a.recovery_share_id JOIN users u ON u.id=r.user_id WHERE a.custodian_id=$1 AND a.status='pending' AND r.status='active' AND r.expires_at>NOW() ORDER BY r.created_at`, user.ID)
	if err != nil {
		respondWithError(w, 500, "Failed to retrieve recovery requests", err)
		return
	}
	defer rows.Close()
	response := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, attemptID uuid.UUID
		var challenge, code, username, first, last, wrapped string
		var expires time.Time
		if err := rows.Scan(&id, &attemptID, &challenge, &code, &expires, &username, &first, &last, &wrapped); err != nil {
			respondWithError(w, 500, "Failed to retrieve recovery requests", err)
			return
		}
		response = append(response, map[string]interface{}{"id": id, "attempt_id": attemptID, "challenge": challenge, "verification_code": code, "expires_at": expires, "owner_username": username, "owner_first_name": first, "owner_last_name": last, "wrapped_share_payload": wrapped})
	}
	if err := rows.Err(); err != nil {
		respondWithError(w, 500, "Failed to retrieve recovery requests", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, 500, "Failed to retrieve recovery requests", err)
		return
	}
	respondWithJSON(w, 200, response)
}

type approveRecoveryCapabilityPayload struct {
	AttemptID          string `json:"attempt_id"`
	Challenge          string `json:"challenge"`
	DecryptedSharePart string `json:"decrypted_share_part"`
}

func (cfg *ApiConfig) handlerApproveRecoveryShareV2(w http.ResponseWriter, r *http.Request, user database.User) {
	if !allowRecoveryRequest(r, "approve:"+user.ID.String(), 20, time.Minute) {
		w.Header().Set("Retry-After", "60")
		respondWithError(w, 429, "Too many recovery approvals. Try again shortly.", nil)
		return
	}
	var p approveRecoveryCapabilityPayload
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRecoverySharePartBytes+4096)).Decode(&p); err != nil {
		respondWithError(w, 400, "Invalid recovery approval", err)
		return
	}
	attemptID, err := uuid.Parse(p.AttemptID)
	if err != nil || len(p.Challenge) < 16 || len(p.Challenge) > 64 || len(p.DecryptedSharePart) == 0 || len(p.DecryptedSharePart) > maxRecoverySharePartBytes || len(p.DecryptedSharePart)%2 != 0 {
		respondWithError(w, 400, "Invalid recovery approval", nil)
		return
	}
	if _, err := hex.DecodeString(p.DecryptedSharePart); err != nil {
		respondWithError(w, 400, "Invalid recovery share", err)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		respondWithError(w, 500, "Failed to approve recovery share", err)
		return
	}
	defer tx.Rollback()
	if err := expireRecoveryAttemptByID(r.Context(), tx, attemptID); err != nil {
		respondWithError(w, 500, "Failed to approve recovery share", err)
		return
	}
	var approvalID, ownerID uuid.UUID
	var status string
	var existing sql.NullString
	err = tx.QueryRowContext(r.Context(), `SELECT a.id,r.user_id,a.status,a.decrypted_share_part FROM account_recovery_attempt_approvals a JOIN account_recovery_attempts r ON r.id=a.attempt_id WHERE a.attempt_id=$1 AND a.custodian_id=$2 AND a.challenge=$3 AND r.status='active' AND r.expires_at>NOW() FOR UPDATE OF a,r`, attemptID, user.ID, p.Challenge).Scan(&approvalID, &ownerID, &status, &existing)
	if errors.Is(err, sql.ErrNoRows) {
		if commitErr := tx.Commit(); commitErr != nil {
			respondWithError(w, 500, "Failed to expire recovery request", commitErr)
			return
		}
		respondWithError(w, 404, "Recovery request is unavailable or expired", nil)
		return
	}
	if err != nil {
		respondWithError(w, 500, "Failed to approve recovery share", err)
		return
	}
	if status == "approved" {
		if existing.Valid && existing.String == p.DecryptedSharePart {
			_ = tx.Commit()
			respondWithJSON(w, 200, map[string]string{"message": "Recovery share already approved"})
			return
		}
		respondWithError(w, 409, "Recovery share was already approved", nil)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE account_recovery_attempt_approvals SET status='approved',decrypted_share_part=$2,approved_at=NOW(),updated_at=NOW() WHERE id=$1`, approvalID, p.DecryptedSharePart); err != nil {
		respondWithError(w, 500, "Failed to approve recovery share", err)
		return
	}
	if err := insertAuditTx(r.Context(), tx, ownerID, "recovery.share_approved", map[string]interface{}{"attempt_id": attemptID, "custodian_id": user.ID}, r); err != nil {
		respondWithError(w, 500, "Failed to audit recovery approval", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, 500, "Failed to approve recovery share", err)
		return
	}
	respondWithJSON(w, 200, map[string]string{"message": "Recovery share approved"})
}

func (cfg *ApiConfig) handlerGetRecoveryStatusV2(w http.ResponseWriter, r *http.Request) {
	setRecoveryNoStoreHeaders(w)
	raw, err := recoveryCapabilityFromRequest(r)
	if err != nil {
		respondWithError(w, 401, "Recovery capability is required", nil)
		return
	}
	if !allowRecoveryRequest(r, "status:"+hashRecoveryCapability(raw), 60, time.Minute) {
		w.Header().Set("Retry-After", "60")
		respondWithError(w, 429, "Too many recovery status checks. Try again shortly.", nil)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, 500, "Recovery status is unavailable", err)
		return
	}
	defer tx.Rollback()
	capabilityHash := hashRecoveryCapability(raw)
	if err := expireRecoveryAttemptByCapability(r.Context(), tx, capabilityHash); err != nil {
		respondWithError(w, 500, "Recovery status is unavailable", err)
		return
	}
	var attemptID uuid.UUID
	var threshold int
	var code string
	var expires time.Time
	err = tx.QueryRowContext(r.Context(), `SELECT id,threshold,verification_code,expires_at FROM account_recovery_attempts WHERE capability_hash=$1 AND status='active' AND expires_at>NOW()`, capabilityHash).Scan(&attemptID, &threshold, &code, &expires)
	if respondRecoveryLookupFailure(w, err, "Recovery status is unavailable", "Recovery request is unavailable or expired", tx.Commit) {
		return
	}
	rows, err := tx.QueryContext(r.Context(), `SELECT share_index,status,decrypted_share_part FROM account_recovery_attempt_approvals WHERE attempt_id=$1 ORDER BY share_index`, attemptID)
	if err != nil {
		respondWithError(w, 500, "Recovery status is unavailable", err)
		return
	}
	defer rows.Close()
	shares := make([]map[string]interface{}, 0)
	for rows.Next() {
		var index int
		var status string
		var part sql.NullString
		if err := rows.Scan(&index, &status, &part); err != nil {
			respondWithError(w, 500, "Recovery status is unavailable", err)
			return
		}
		item := map[string]interface{}{"share_index": index, "custodian_label": fmt.Sprintf("Custodian %d", index), "status": status}
		if status == "approved" && part.Valid {
			item["decrypted_share_part"] = part.String
		}
		shares = append(shares, item)
	}
	if err := rows.Err(); err != nil {
		respondWithError(w, 500, "Recovery status is unavailable", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, 500, "Recovery status is unavailable", err)
		return
	}
	respondWithJSON(w, 200, map[string]interface{}{"attempt_id": attemptID, "verification_code": code, "expires_at": expires, "threshold": threshold, "shares": shares})
}

type resetRecoveryCapabilityPayload struct {
	NewPassword            string `json:"new_password_hash"`
	NewPrivateKeyEncrypted string `json:"new_private_key_encrypted"`
	KekEnvelopeVersion     int32  `json:"kek_envelope_version"`
}

func (cfg *ApiConfig) handlerResetRecoveryPasswordV2(w http.ResponseWriter, r *http.Request) {
	setRecoveryNoStoreHeaders(w)
	raw, err := recoveryCapabilityFromRequest(r)
	if err != nil {
		respondWithError(w, 401, "Recovery capability is required", nil)
		return
	}
	if !allowRecoveryRequest(r, "reset:"+hashRecoveryCapability(raw), 5, time.Hour) {
		w.Header().Set("Retry-After", "3600")
		respondWithError(w, 429, "Too many recovery reset attempts. Try again later.", nil)
		return
	}
	var p resetRecoveryCapabilityPayload
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512*1024)).Decode(&p); err != nil || len(p.NewPassword) < 8 || len([]byte(p.NewPassword)) > 72 || len(p.NewPrivateKeyEncrypted) < 32 || len(p.NewPrivateKeyEncrypted) > 512*1024 || p.KekEnvelopeVersion != 2 {
		respondWithError(w, 400, "Invalid recovery reset payload", err)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		respondWithError(w, 500, "Account recovery failed", err)
		return
	}
	defer tx.Rollback()
	capabilityHash := hashRecoveryCapability(raw)
	if err := expireRecoveryAttemptByCapability(r.Context(), tx, capabilityHash); err != nil {
		respondWithError(w, 500, "Account recovery failed", err)
		return
	}
	var attemptID, ownerID uuid.UUID
	var threshold int
	err = tx.QueryRowContext(r.Context(), `SELECT r.id,r.user_id,r.threshold FROM account_recovery_attempts r JOIN users u ON u.id=r.user_id WHERE r.capability_hash=$1 AND r.status='active' AND r.expires_at>NOW() FOR UPDATE OF r,u`, capabilityHash).Scan(&attemptID, &ownerID, &threshold)
	if respondRecoveryLookupFailure(w, err, "Account recovery failed", "Recovery request is unavailable or expired", tx.Commit) {
		return
	}
	var approved int
	if err := tx.QueryRowContext(r.Context(), `SELECT COUNT(DISTINCT custodian_id) FROM account_recovery_attempt_approvals WHERE attempt_id=$1 AND status='approved' AND decrypted_share_part IS NOT NULL`, attemptID).Scan(&approved); err != nil {
		respondWithError(w, 500, "Account recovery failed", err)
		return
	}
	if approved < threshold {
		respondWithError(w, 403, "Insufficient custodian approvals", nil)
		return
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(p.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		respondWithError(w, 500, "Failed to prepare password reset", err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE users SET password_hash=$2,private_key_encrypted=$3,kek_envelope_version=$4,pin_hash=NULL,pin_set_at=NULL,private_key_pin_encrypted=NULL,pin_failed_attempts=0,pin_locked_until=NULL,force_password_change=FALSE,updated_at=NOW() WHERE id=$1`, ownerID, string(hashed), p.NewPrivateKeyEncrypted, p.KekEnvelopeVersion); err != nil {
		respondWithError(w, 500, "Account recovery failed", err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE refresh_tokens SET revoked_at=NOW(),updated_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL`, ownerID); err != nil {
		respondWithError(w, 500, "Account recovery failed", err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `DELETE FROM account_recovery_attempt_approvals WHERE attempt_id=$1`, attemptID); err != nil {
		respondWithError(w, 500, "Account recovery failed", err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE account_recovery_attempts SET status='consumed',consumed_at=NOW(),updated_at=NOW() WHERE id=$1`, attemptID); err != nil {
		respondWithError(w, 500, "Account recovery failed", err)
		return
	}
	if err := insertAuditTx(r.Context(), tx, ownerID, "user.recovered", map[string]interface{}{"attempt_id": attemptID, "approval_count": approved, "threshold": threshold}, r); err != nil {
		respondWithError(w, 500, "Account recovery audit failed", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, 500, "Account recovery failed", err)
		return
	}
	respondWithJSON(w, 200, map[string]string{"message": "Account recovered. Sign in and enroll a new PIN."})
}

func (cfg *ApiConfig) handlerCancelRecoveryV2(w http.ResponseWriter, r *http.Request) {
	setRecoveryNoStoreHeaders(w)
	raw, err := recoveryCapabilityFromRequest(r)
	if err != nil {
		respondWithError(w, 401, "Recovery capability is required", nil)
		return
	}
	if !allowRecoveryRequest(r, "cancel:"+hashRecoveryCapability(raw), 5, time.Hour) {
		w.Header().Set("Retry-After", "3600")
		respondWithError(w, 429, "Too many recovery cancellation attempts. Try again later.", nil)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		respondWithError(w, 500, "Recovery cancellation failed", err)
		return
	}
	defer tx.Rollback()
	capabilityHash := hashRecoveryCapability(raw)
	if err := expireRecoveryAttemptByCapability(r.Context(), tx, capabilityHash); err != nil {
		respondWithError(w, 500, "Recovery cancellation failed", err)
		return
	}
	var attemptID, ownerID uuid.UUID
	err = tx.QueryRowContext(r.Context(), `SELECT id,user_id FROM account_recovery_attempts WHERE capability_hash=$1 AND status='active' AND expires_at>NOW() FOR UPDATE`, capabilityHash).Scan(&attemptID, &ownerID)
	if respondRecoveryLookupFailure(w, err, "Recovery cancellation failed", "Recovery request is unavailable or expired", tx.Commit) {
		return
	}
	if _, err := tx.ExecContext(r.Context(), `DELETE FROM account_recovery_attempt_approvals WHERE attempt_id=$1`, attemptID); err != nil {
		respondWithError(w, 500, "Recovery cancellation failed", err)
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE account_recovery_attempts SET status='cancelled',updated_at=NOW() WHERE id=$1`, attemptID); err != nil {
		respondWithError(w, 500, "Recovery cancellation failed", err)
		return
	}
	if err := insertAuditTx(r.Context(), tx, ownerID, "recovery.cancelled", map[string]interface{}{"attempt_id": attemptID}, r); err != nil {
		respondWithError(w, 500, "Recovery cancellation audit failed", err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, 500, "Recovery cancellation failed", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func respondRecoveryLookupFailure(w http.ResponseWriter, err error, unavailableMessage, missingMessage string, commitCleanup func() error) bool {
	if err == nil {
		return false
	}
	if !errors.Is(err, sql.ErrNoRows) {
		respondWithError(w, http.StatusServiceUnavailable, unavailableMessage, err)
		return true
	}
	if commitErr := commitCleanup(); commitErr != nil {
		respondWithError(w, http.StatusServiceUnavailable, unavailableMessage, commitErr)
		return true
	}
	respondWithError(w, http.StatusUnauthorized, missingMessage, nil)
	return true
}

func (cfg *ApiConfig) registerRecoveryRoutes(mux *http.ServeMux) {
	mux.Handle("POST /api/v1/recovery/shares", cfg.middlewareMetricsInc(cfg.middlewareAuth(cfg.handlerSaveRecoverySharesV2)))
	mux.Handle("GET /api/v1/recovery/config", cfg.middlewareMetricsInc(cfg.middlewareAuth(cfg.handlerGetRecoveryConfigV2)))
	mux.Handle("POST /api/v1/recovery/request", cfg.middlewareMetricsInc(http.HandlerFunc(cfg.handlerStartRecoveryRequestV2)))
	mux.Handle("GET /api/v1/recovery/requests", cfg.middlewareMetricsInc(cfg.middlewareAuth(cfg.handlerGetRecoveryRequestsV2)))
	mux.Handle("POST /api/v1/recovery/approve", cfg.middlewareMetricsInc(cfg.middlewareAuth(cfg.handlerApproveRecoveryShareV2)))
	mux.Handle("GET /api/v1/recovery/status", cfg.middlewareMetricsInc(http.HandlerFunc(cfg.handlerGetRecoveryStatusV2)))
	mux.Handle("POST /api/v1/recovery/reset", cfg.middlewareMetricsInc(http.HandlerFunc(cfg.handlerResetRecoveryPasswordV2)))
	mux.Handle("POST /api/v1/recovery/cancel", cfg.middlewareMetricsInc(http.HandlerFunc(cfg.handlerCancelRecoveryV2)))
}
