package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func installAuditFailureTrigger(t *testing.T, db *sql.DB, userID uuid.UUID, action string) {
	t.Helper()
	suffix := strings.ReplaceAll(uuid.NewString(), "-", "")
	functionName := pq.QuoteIdentifier("test_fail_audit_" + suffix)
	triggerName := pq.QuoteIdentifier("test_fail_audit_trigger_" + suffix)
	statement := fmt.Sprintf(`
		CREATE FUNCTION %s() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NEW.user_id = '%s'::uuid AND NEW.action = '%s' THEN
				RAISE EXCEPTION 'fixture-forced audit failure';
			END IF;
			RETURN NEW;
		END $$;
		CREATE TRIGGER %s BEFORE INSERT ON audit_logs
		FOR EACH ROW EXECUTE FUNCTION %s();`, functionName, userID, action, triggerName, functionName)
	if _, err := db.Exec(statement); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON audit_logs; DROP FUNCTION IF EXISTS %s()`, triggerName, functionName))
	})
}

func openCredentialTestDB(t *testing.T) (*sql.DB, *ApiConfig) {
	t.Helper()
	dsn := os.Getenv("DB_URL")
	if dsn == "" {
		t.Skip("DB_URL not set")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Ping(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db, &ApiConfig{db: db, dbQueries: database.New(db), jwtSecret: "test-secret"}
}

func insertCredentialUser(t *testing.T, db *sql.DB, username string, version int) uuid.UUID {
	t.Helper()
	id := uuid.New()
	hash, err := auth.HashPassword("old-password")
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO users(id,first_name,last_name,username,email,password_hash,public_key,private_key_encrypted,created_at,updated_at,kek_envelope_version,force_password_change) VALUES($1,'Test','User',$2,$3,$4,'public-key','old-envelope',NOW(),NOW(),$5,TRUE)`, id, username, username+"@example.test", hash, version)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM users WHERE id=$1`, id) })
	return id
}

func requestJSON(t *testing.T, method, path string, body interface{}, token string) *http.Request {
	t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(method, path, bytes.NewReader(data))
	r.Header.Set("Content-Type", "application/json")
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	return r
}

func TestRecoveryCapabilityProtocolBindsApprovalsAndConsumesOnce(t *testing.T) {
	db, cfg := openCredentialTestDB(t)
	owner := insertCredentialUser(t, db, "owner-"+uuid.NewString(), 1)
	custodian := insertCredentialUser(t, db, "custodian-"+uuid.NewString(), 1)
	payload := saveRecoverySharesPayload{Threshold: 1, Shares: []recoveryShareInput{{CustodianID: custodian.String(), WrappedSharePayload: `{"wrapped_key":"a","iv":"b","ciphertext":"c"}`}}}
	w := httptest.NewRecorder()
	cfg.handlerSaveRecoverySharesV2(w, requestJSON(t, "POST", "/api/v1/recovery/shares", payload, ""), database.User{ID: owner})
	if w.Code != 200 {
		t.Fatalf("save config: %d %s", w.Code, w.Body.String())
	}
	var status string
	var part sql.NullString
	if err := db.QueryRow(`SELECT status,decrypted_share_part FROM account_recovery_shares WHERE user_id=$1`, owner).Scan(&status, &part); err != nil {
		t.Fatal(err)
	}
	if status != "configured" || part.Valid {
		t.Fatalf("configuration leaked attempt state: %s %#v", status, part)
	}
	w = httptest.NewRecorder()
	cfg.handlerGetRecoveryRequestsV2(w, httptest.NewRequest("GET", "/api/v1/recovery/requests", nil), database.User{ID: custodian})
	if w.Code != 200 || w.Body.String() != "[]" {
		t.Fatalf("configured share appeared pending: %d %s", w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	cfg.handlerStartRecoveryRequestV2(w, requestJSON(t, "POST", "/api/v1/recovery/request", map[string]string{"username": usernameForID(t, db, owner)}, ""))
	if w.Code != 202 {
		t.Fatalf("start: %d %s", w.Code, w.Body.String())
	}
	var started struct {
		RecoveryToken    string `json:"recovery_token"`
		VerificationCode string `json:"verification_code"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &started); err != nil {
		t.Fatal(err)
	}
	if started.RecoveryToken == "" || started.VerificationCode == "" {
		t.Fatal("missing capability response")
	}
	var storedHash string
	if err := db.QueryRow(`SELECT capability_hash FROM account_recovery_attempts WHERE user_id=$1 AND status='active'`, owner).Scan(&storedHash); err != nil {
		t.Fatal(err)
	}
	if storedHash == started.RecoveryToken || storedHash != hashRecoveryCapability(started.RecoveryToken) {
		t.Fatal("raw recovery capability was stored")
	}
	w = httptest.NewRecorder()
	cfg.handlerGetRecoveryStatusV2(w, httptest.NewRequest("GET", "/api/v1/recovery/status?username=owner", nil))
	if w.Code != 401 || bytes.Contains(w.Body.Bytes(), []byte("decrypted_share_part")) {
		t.Fatalf("unauthorized status leaked: %d %s", w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	cfg.handlerGetRecoveryRequestsV2(w, httptest.NewRequest("GET", "/api/v1/recovery/requests", nil), database.User{ID: custodian})
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var requests []struct {
		AttemptID string `json:"attempt_id"`
		Challenge string `json:"challenge"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &requests); err != nil || len(requests) != 1 {
		t.Fatalf("requests: %v %s", err, w.Body.String())
	}
	w = httptest.NewRecorder()
	cfg.handlerApproveRecoveryShareV2(w, requestJSON(t, "POST", "/api/v1/recovery/approve", map[string]string{"attempt_id": requests[0].AttemptID, "challenge": "wrong-challenge-0000", "decrypted_share_part": "aa"}, ""), database.User{ID: custodian})
	if w.Code == 200 {
		t.Fatal("wrong challenge approved")
	}
	w = httptest.NewRecorder()
	cfg.handlerApproveRecoveryShareV2(w, requestJSON(t, "POST", "/api/v1/recovery/approve", map[string]string{"attempt_id": requests[0].AttemptID, "challenge": requests[0].Challenge, "decrypted_share_part": "aa"}, ""), database.User{ID: custodian})
	if w.Code != 200 {
		t.Fatalf("approve: %d %s", w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	cfg.handlerGetRecoveryStatusV2(w, requestJSON(t, "GET", "/api/v1/recovery/status", nil, started.RecoveryToken))
	if w.Code != 200 || bytes.Contains(w.Body.Bytes(), []byte("email")) || !bytes.Contains(w.Body.Bytes(), []byte(`"share_index":1`)) {
		t.Fatalf("safe status: %d %s", w.Code, w.Body.String())
	}
	reset := map[string]interface{}{"new_password_hash": "new-password", "new_private_key_encrypted": "01234567890123456789012345678901", "kek_envelope_version": 2}
	codes := make(chan int, 2)
	var resetRace sync.WaitGroup
	for range 2 {
		resetRace.Add(1)
		go func() {
			defer resetRace.Done()
			recorder := httptest.NewRecorder()
			cfg.handlerResetRecoveryPasswordV2(recorder, requestJSON(t, "POST", "/api/v1/recovery/reset", reset, started.RecoveryToken))
			codes <- recorder.Code
		}()
	}
	resetRace.Wait()
	close(codes)
	successes := 0
	for code := range codes {
		if code == http.StatusOK {
			successes++
		}
	}
	if successes != 1 {
		t.Fatalf("concurrent capability reset succeeded %d times, want exactly once", successes)
	}
	var configCount, approvalCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM account_recovery_shares WHERE user_id=$1`, owner).Scan(&configCount); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM account_recovery_attempt_approvals a JOIN account_recovery_attempts r ON r.id=a.attempt_id WHERE r.user_id=$1`, owner).Scan(&approvalCount); err != nil {
		t.Fatal(err)
	}
	if configCount != 1 || approvalCount != 0 {
		t.Fatalf("cleanup/config mismatch %d %d", configCount, approvalCount)
	}
	w = httptest.NewRecorder()
	cfg.handlerResetRecoveryPasswordV2(w, requestJSON(t, "POST", "/api/v1/recovery/reset", reset, started.RecoveryToken))
	if w.Code == 200 {
		t.Fatal("consumed capability replayed")
	}
}

func usernameForID(t *testing.T, db *sql.DB, id uuid.UUID) string {
	t.Helper()
	var username string
	if err := db.QueryRow(`SELECT username FROM users WHERE id=$1`, id).Scan(&username); err != nil {
		t.Fatal(err)
	}
	return username
}

func TestCredentialMutationsPreserveVersionAndAreAtomic(t *testing.T) {
	db, cfg := openCredentialTestDB(t)
	id := insertCredentialUser(t, db, "credential-"+uuid.NewString(), 2)
	r := httptest.NewRequest("POST", "/api/users/change-password", nil)
	newHash, err := auth.HashPassword("new-password")
	if err != nil {
		t.Fatal(err)
	}
	if err := cfg.changePasswordAtomically(context.Background(), id, "old-password", newHash, "new-envelope-v2", 2, r); err != nil {
		t.Fatal(err)
	}
	var version int
	var envelope string
	var forced bool
	if err := db.QueryRow(`SELECT kek_envelope_version,private_key_encrypted,force_password_change FROM users WHERE id=$1`, id).Scan(&version, &envelope, &forced); err != nil {
		t.Fatal(err)
	}
	if version != 2 || envelope != "new-envelope-v2" || forced {
		t.Fatalf("password mutation mismatch %d %s %v", version, envelope, forced)
	}
	pinHash, err := auth.HashPassword("1234")
	if err != nil {
		t.Fatal(err)
	}
	if err := cfg.setPINAtomically(context.Background(), id, setPINMutation{PINHash: pinHash, PrivateKeyPinEncrypted: strings.Repeat("p", 32), PrivateKeyEncrypted: strings.Repeat("r", 32), KekEnvelopeVersion: 2, HasKekEnvelopeVersion: true}, r); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT private_key_encrypted,private_key_pin_encrypted,kek_envelope_version FROM users WHERE id=$1`, id).Scan(&envelope, new(string), &version); err != nil {
		t.Fatal(err)
	}
	if envelope != strings.Repeat("r", 32) || version != 2 {
		t.Fatal("PIN repair did not persist correct envelope version")
	}
	var auditCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM audit_logs WHERE user_id=$1 AND action IN ('user.password_changed','user.pin_enrolled')`, id).Scan(&auditCount); err != nil {
		t.Fatal(err)
	}
	if auditCount != 2 {
		t.Fatalf("credential mutations persisted without required audits: %d", auditCount)
	}
}

func TestLoginEnvelopeMigrationClearsIncompatiblePINAtomically(t *testing.T) {
	db, cfg := openCredentialTestDB(t)
	id := insertCredentialUser(t, db, "migration-"+uuid.NewString(), 1)
	pinHash, err := auth.HashPassword("1234")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE users SET pin_hash=$2,pin_set_at=NOW(),private_key_pin_encrypted='legacy-pin-envelope' WHERE id=$1`, id, pinHash); err != nil {
		t.Fatal(err)
	}

	result, err := cfg.migrateLoginEnvelopeAtomically(context.Background(), id, "old-password", "argon-envelope", httptest.NewRequest("POST", "/api/login", nil))
	if err != nil {
		t.Fatal(err)
	}
	if result.KekEnvelopeVersion != 2 || result.PrivateKeyEncrypted != "argon-envelope" || result.PinHash.Valid || result.PrivateKeyPinEncrypted.Valid {
		t.Fatalf("migration result retained incompatible PIN state: %#v", result)
	}
	var version int
	var storedPIN, storedPINEnvelope sql.NullString
	if err := db.QueryRow(`SELECT kek_envelope_version,pin_hash,private_key_pin_encrypted FROM users WHERE id=$1`, id).Scan(&version, &storedPIN, &storedPINEnvelope); err != nil {
		t.Fatal(err)
	}
	if version != 2 || storedPIN.Valid || storedPINEnvelope.Valid {
		t.Fatalf("migration was not atomic: %d %#v %#v", version, storedPIN, storedPINEnvelope)
	}
	var audits int
	if err := db.QueryRow(`SELECT COUNT(*) FROM audit_logs WHERE user_id=$1 AND action='user.key_envelope_migrated'`, id).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if audits != 1 {
		t.Fatalf("migration audit count=%d", audits)
	}
}

func TestExpiredRecoveryCleanupPersistsAndRandomCapabilityDoesNotReachReset(t *testing.T) {
	db, cfg := openCredentialTestDB(t)
	owner := insertCredentialUser(t, db, "expired-owner-"+uuid.NewString(), 1)
	custodian := insertCredentialUser(t, db, "expired-custodian-"+uuid.NewString(), 1)
	var shareID uuid.UUID
	if err := db.QueryRow(`INSERT INTO account_recovery_shares(user_id,custodian_id,wrapped_share_payload,status,created_at,updated_at) VALUES($1,$2,'wrapped','configured',NOW(),NOW()) RETURNING id`, owner, custodian).Scan(&shareID); err != nil {
		t.Fatal(err)
	}
	raw, tokenHash, err := newRecoveryCapability()
	if err != nil {
		t.Fatal(err)
	}
	var attemptID uuid.UUID
	if err := db.QueryRow(`INSERT INTO account_recovery_attempts(user_id,capability_hash,verification_code,threshold,status,created_at,updated_at,expires_at) VALUES($1,$2,'DEADBEEF',1,'active',NOW()-INTERVAL '2 minutes',NOW()-INTERVAL '2 minutes',NOW()-INTERVAL '1 minute') RETURNING id`, owner, tokenHash).Scan(&attemptID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO account_recovery_attempt_approvals(attempt_id,recovery_share_id,custodian_id,share_index,challenge,status,decrypted_share_part,approved_at) VALUES($1,$2,$3,1,'expired-challenge-123456','approved','aa',NOW())`, attemptID, shareID, custodian); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	cfg.handlerGetRecoveryStatusV2(w, requestJSON(t, "GET", "/api/v1/recovery/status", nil, raw))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expired status=%d %s", w.Code, w.Body.String())
	}
	var status string
	var approvals int
	if err := db.QueryRow(`SELECT status FROM account_recovery_attempts WHERE id=$1`, attemptID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM account_recovery_attempt_approvals WHERE attempt_id=$1`, attemptID).Scan(&approvals); err != nil {
		t.Fatal(err)
	}
	if status != "expired" || approvals != 0 {
		t.Fatalf("expiry cleanup rolled back: %s %d", status, approvals)
	}

	random, _, err := newRecoveryCapability()
	if err != nil {
		t.Fatal(err)
	}
	validReset := map[string]interface{}{"new_password_hash": "new-password", "new_private_key_encrypted": "01234567890123456789012345678901", "kek_envelope_version": 2}
	w = httptest.NewRecorder()
	cfg.handlerResetRecoveryPasswordV2(w, requestJSON(t, "POST", "/api/v1/recovery/reset", validReset, random))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("random capability reset=%d %s", w.Code, w.Body.String())
	}
	validReset["new_password_hash"] = "1234567890123456789012345678901234567890123456789012345678901234567890123"
	w = httptest.NewRecorder()
	cfg.handlerResetRecoveryPasswordV2(w, requestJSON(t, "POST", "/api/v1/recovery/reset", validReset, random))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("overlong bcrypt password=%d %s", w.Code, w.Body.String())
	}
}

func TestRequiredAuditFailureRollsBackCredentialAndRecoveryMutations(t *testing.T) {
	t.Run("password", func(t *testing.T) {
		db, cfg := openCredentialTestDB(t)
		id := insertCredentialUser(t, db, "audit-password-"+uuid.NewString(), 2)
		installAuditFailureTrigger(t, db, id, "user.password_changed")
		newHash, err := auth.HashPassword("new-password")
		if err != nil {
			t.Fatal(err)
		}
		err = cfg.changePasswordAtomically(context.Background(), id, "old-password", newHash, "new-envelope", 2, httptest.NewRequest("POST", "/api/users/change-password", nil))
		if err == nil {
			t.Fatal("password change succeeded without required audit")
		}
		var passwordHash, envelope string
		var forced bool
		if err := db.QueryRow(`SELECT password_hash,private_key_encrypted,force_password_change FROM users WHERE id=$1`, id).Scan(&passwordHash, &envelope, &forced); err != nil {
			t.Fatal(err)
		}
		if auth.CheckPasswordHash("old-password", passwordHash) != nil || envelope != "old-envelope" || !forced {
			t.Fatal("password mutation was not rolled back after audit failure")
		}
	})

	t.Run("pin", func(t *testing.T) {
		db, cfg := openCredentialTestDB(t)
		id := insertCredentialUser(t, db, "audit-pin-"+uuid.NewString(), 2)
		installAuditFailureTrigger(t, db, id, "user.pin_enrolled")
		pinHash, err := auth.HashPassword("1234")
		if err != nil {
			t.Fatal(err)
		}
		err = cfg.setPINAtomically(context.Background(), id, setPINMutation{PINHash: pinHash, PrivateKeyPinEncrypted: strings.Repeat("p", 32), PrivateKeyEncrypted: strings.Repeat("r", 32), KekEnvelopeVersion: 2, HasKekEnvelopeVersion: true}, httptest.NewRequest("POST", "/api/users/pin", nil))
		if err == nil {
			t.Fatal("PIN enrollment succeeded without required audit")
		}
		var pinHashStored, pinEnvelope sql.NullString
		var envelope string
		if err := db.QueryRow(`SELECT pin_hash,private_key_pin_encrypted,private_key_encrypted FROM users WHERE id=$1`, id).Scan(&pinHashStored, &pinEnvelope, &envelope); err != nil {
			t.Fatal(err)
		}
		if pinHashStored.Valid || pinEnvelope.Valid || envelope != "old-envelope" {
			t.Fatal("PIN mutation was not rolled back after audit failure")
		}
	})

	t.Run("login migration", func(t *testing.T) {
		db, cfg := openCredentialTestDB(t)
		id := insertCredentialUser(t, db, "audit-migration-"+uuid.NewString(), 1)
		installAuditFailureTrigger(t, db, id, "user.key_envelope_migrated")
		if _, err := cfg.migrateLoginEnvelopeAtomically(context.Background(), id, "old-password", "argon-envelope", httptest.NewRequest("POST", "/api/login", nil)); err == nil {
			t.Fatal("login migration succeeded without required audit")
		}
		var envelope string
		var version int
		if err := db.QueryRow(`SELECT private_key_encrypted,kek_envelope_version FROM users WHERE id=$1`, id).Scan(&envelope, &version); err != nil {
			t.Fatal(err)
		}
		if envelope != "old-envelope" || version != 1 {
			t.Fatal("login envelope migration was not rolled back after audit failure")
		}
	})

	t.Run("recovery reset", func(t *testing.T) {
		db, cfg := openCredentialTestDB(t)
		owner := insertCredentialUser(t, db, "audit-recovery-owner-"+uuid.NewString(), 1)
		custodian := insertCredentialUser(t, db, "audit-recovery-custodian-"+uuid.NewString(), 1)
		var shareID uuid.UUID
		if err := db.QueryRow(`INSERT INTO account_recovery_shares(user_id,custodian_id,wrapped_share_payload,status,created_at,updated_at) VALUES($1,$2,'wrapped','configured',NOW(),NOW()) RETURNING id`, owner, custodian).Scan(&shareID); err != nil {
			t.Fatal(err)
		}
		raw, tokenHash, err := newRecoveryCapability()
		if err != nil {
			t.Fatal(err)
		}
		var attemptID uuid.UUID
		if err := db.QueryRow(`INSERT INTO account_recovery_attempts(user_id,capability_hash,verification_code,threshold,status,expires_at) VALUES($1,$2,'A1B2C3D4',1,'active',NOW()+INTERVAL '1 hour') RETURNING id`, owner, tokenHash).Scan(&attemptID); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(`INSERT INTO account_recovery_attempt_approvals(attempt_id,recovery_share_id,custodian_id,share_index,challenge,status,decrypted_share_part,approved_at) VALUES($1,$2,$3,1,'audit-failure-challenge','approved','aa',NOW())`, attemptID, shareID, custodian); err != nil {
			t.Fatal(err)
		}
		refreshToken := "fixture-refresh-" + uuid.NewString()
		if _, err := db.Exec(`INSERT INTO refresh_tokens(token,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 day')`, refreshToken, owner); err != nil {
			t.Fatal(err)
		}
		installAuditFailureTrigger(t, db, owner, "user.recovered")
		w := httptest.NewRecorder()
		cfg.handlerResetRecoveryPasswordV2(w, requestJSON(t, "POST", "/api/v1/recovery/reset", map[string]interface{}{
			"new_password_hash": "new-password", "new_private_key_encrypted": "01234567890123456789012345678901", "kek_envelope_version": 2,
		}, raw))
		if w.Code != http.StatusInternalServerError {
			t.Fatalf("recovery audit failure status=%d body=%s", w.Code, w.Body.String())
		}
		var passwordHash, envelope, attemptStatus string
		var version, approvals int
		var revoked sql.NullTime
		if err := db.QueryRow(`SELECT password_hash,private_key_encrypted,kek_envelope_version FROM users WHERE id=$1`, owner).Scan(&passwordHash, &envelope, &version); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(`SELECT status FROM account_recovery_attempts WHERE id=$1`, attemptID).Scan(&attemptStatus); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(`SELECT COUNT(*) FROM account_recovery_attempt_approvals WHERE attempt_id=$1`, attemptID).Scan(&approvals); err != nil {
			t.Fatal(err)
		}
		if err := db.QueryRow(`SELECT revoked_at FROM refresh_tokens WHERE token=$1`, refreshToken).Scan(&revoked); err != nil {
			t.Fatal(err)
		}
		if auth.CheckPasswordHash("old-password", passwordHash) != nil || envelope != "old-envelope" || version != 1 || attemptStatus != "active" || approvals != 1 || revoked.Valid {
			t.Fatal("recovery reset was not fully rolled back after audit failure")
		}
	})
}

func TestInvalidPINEnvelopeRequestLeavesCredentialStateUnchanged(t *testing.T) {
	db, cfg := openCredentialTestDB(t)
	id := insertCredentialUser(t, db, "invalid-pin-envelope-"+uuid.NewString(), 2)
	w := httptest.NewRecorder()
	cfg.handlerSetUserPIN(w, requestJSON(t, http.MethodPost, "/api/users/pin", map[string]interface{}{
		"pin":                       "1234",
		"private_key_pin_encrypted": "",
		"kek_envelope_version":      2,
	}, ""), database.User{ID: id})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid PIN envelope status=%d body=%s", w.Code, w.Body.String())
	}
	var pinHash, pinEnvelope sql.NullString
	var passwordEnvelope string
	if err := db.QueryRow(`SELECT pin_hash,private_key_pin_encrypted,private_key_encrypted FROM users WHERE id=$1`, id).Scan(&pinHash, &pinEnvelope, &passwordEnvelope); err != nil {
		t.Fatal(err)
	}
	if pinHash.Valid || pinEnvelope.Valid || passwordEnvelope != "old-envelope" {
		t.Fatal("invalid PIN envelope request mutated stored credential state")
	}
}
