package main

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

var (
	errCredentialChanged = errors.New("credential changed during request")
	errIncorrectPIN      = errors.New("incorrect current PIN")
	errPINLocked         = errors.New("PIN is temporarily locked")
)

func insertAuditTx(ctx context.Context, tx *sql.Tx, userID uuid.UUID, action string, metadata interface{}, r *http.Request) error {
	_, err := database.New(tx).CreateAuditLog(ctx, database.CreateAuditLogParams{
		UserID:       nullUUID(userID),
		Action:       action,
		ResourceType: "user",
		ResourceID:   nullUUID(userID),
		Metadata:     marshalJSONB(metadata),
		IpAddress:    requestInet(r),
		CreatedAt:    time.Now().UTC(),
	})
	return err
}

func (cfg *ApiConfig) changePasswordAtomically(
	ctx context.Context,
	userID uuid.UUID,
	oldPassword string,
	newPasswordHash string,
	privateKeyEncrypted string,
	kekEnvelopeVersion int32,
	r *http.Request,
) error {
	tx, err := cfg.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentPasswordHash, currentPrivateKey string
	var currentVersion int32
	if err := tx.QueryRowContext(ctx, `
		SELECT password_hash, private_key_encrypted, kek_envelope_version
		FROM users WHERE id = $1 FOR UPDATE`, userID,
	).Scan(&currentPasswordHash, &currentPrivateKey, &currentVersion); err != nil {
		return err
	}
	if err := auth.CheckPasswordHash(oldPassword, currentPasswordHash); err != nil {
		return errCredentialChanged
	}
	if currentPrivateKey != "" && privateKeyEncrypted == "" {
		return errors.New("encrypted private key is required")
	}
	if currentVersion != kekEnvelopeVersion {
		return errors.New("key envelope version changed during request")
	}

	result, err := tx.ExecContext(ctx, `
		UPDATE users
		SET password_hash = $2,
		    private_key_encrypted = $3,
		    kek_envelope_version = $4,
		    force_password_change = FALSE,
		    updated_at = $5
		WHERE id = $1 AND password_hash = $6 AND kek_envelope_version = $7`,
		userID, newPasswordHash, privateKeyEncrypted, kekEnvelopeVersion, time.Now().UTC(),
		currentPasswordHash, currentVersion,
	)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil || affected != 1 {
		if err != nil {
			return err
		}
		return errCredentialChanged
	}
	if err := insertAuditTx(ctx, tx, userID, "user.password_changed", map[string]interface{}{
		"kek_envelope_version":  kekEnvelopeVersion,
		"forced_change_cleared": true,
	}, r); err != nil {
		return err
	}
	return tx.Commit()
}

type loginMigrationResult struct {
	PrivateKeyEncrypted    string
	KekEnvelopeVersion     int32
	PrivateKeyPinEncrypted sql.NullString
	PinHash                sql.NullString
}

func (cfg *ApiConfig) migrateLoginEnvelopeAtomically(
	ctx context.Context,
	userID uuid.UUID,
	password string,
	rewrapped string,
	r *http.Request,
) (loginMigrationResult, error) {
	tx, err := cfg.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return loginMigrationResult{}, err
	}
	defer tx.Rollback()

	var result loginMigrationResult
	var passwordHash string
	if err := tx.QueryRowContext(ctx, `
		SELECT password_hash, private_key_encrypted, kek_envelope_version,
		       private_key_pin_encrypted, pin_hash
		FROM users WHERE id = $1 FOR UPDATE`, userID,
	).Scan(&passwordHash, &result.PrivateKeyEncrypted, &result.KekEnvelopeVersion,
		&result.PrivateKeyPinEncrypted, &result.PinHash); err != nil {
		return loginMigrationResult{}, err
	}
	if err := auth.CheckPasswordHash(password, passwordHash); err != nil {
		return loginMigrationResult{}, errCredentialChanged
	}
	if result.KekEnvelopeVersion != 1 {
		if err := tx.Commit(); err != nil {
			return loginMigrationResult{}, err
		}
		return result, nil
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE users
		SET private_key_encrypted = $2,
		    kek_envelope_version = 2,
		    pin_hash = NULL,
		    pin_set_at = NULL,
		    private_key_pin_encrypted = NULL,
		    pin_failed_attempts = 0,
		    pin_locked_until = NULL,
		    updated_at = $3
		WHERE id = $1`, userID, rewrapped, time.Now().UTC()); err != nil {
		return loginMigrationResult{}, err
	}
	if err := insertAuditTx(ctx, tx, userID, "user.key_envelope_migrated", map[string]interface{}{
		"from_version":              1,
		"to_version":                2,
		"pin_reenrollment_required": true,
	}, r); err != nil {
		return loginMigrationResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return loginMigrationResult{}, err
	}
	result.PrivateKeyEncrypted = rewrapped
	result.KekEnvelopeVersion = 2
	result.PrivateKeyPinEncrypted = sql.NullString{}
	result.PinHash = sql.NullString{}
	return result, nil
}

type setPINMutation struct {
	PINHash                string
	OldPIN                 string
	PrivateKeyPinEncrypted string
	PrivateKeyEncrypted    string
	KekEnvelopeVersion     int32
	HasKekEnvelopeVersion  bool
}

func (cfg *ApiConfig) setPINAtomically(ctx context.Context, userID uuid.UUID, mutation setPINMutation, r *http.Request) error {
	if len(mutation.PrivateKeyPinEncrypted) < 32 || len(mutation.PrivateKeyPinEncrypted) > 512*1024 || !mutation.HasKekEnvelopeVersion || (mutation.KekEnvelopeVersion != 1 && mutation.KekEnvelopeVersion != 2) {
		return errors.New("valid PIN key envelope and version are required")
	}
	if mutation.PrivateKeyEncrypted != "" && (len(mutation.PrivateKeyEncrypted) < 32 || len(mutation.PrivateKeyEncrypted) > 512*1024) {
		return errors.New("invalid repaired password key envelope")
	}
	tx, err := cfg.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentPIN sql.NullString
	var failedAttempts int
	var lockedUntil sql.NullTime
	var currentVersion int32
	if err := tx.QueryRowContext(ctx, `
		SELECT pin_hash, pin_failed_attempts, pin_locked_until, kek_envelope_version
		FROM users WHERE id = $1 FOR UPDATE`, userID,
	).Scan(&currentPIN, &failedAttempts, &lockedUntil, &currentVersion); err != nil {
		return err
	}
	if lockedUntil.Valid && lockedUntil.Time.After(time.Now()) {
		return errPINLocked
	}
	if currentPIN.Valid && currentPIN.String != "" {
		if mutation.OldPIN == "" || auth.CheckPasswordHash(mutation.OldPIN, currentPIN.String) != nil {
			failedAttempts++
			var nextLock interface{}
			if failedAttempts >= 5 {
				nextLock = time.Now().UTC().Add(15 * time.Minute)
			}
			if _, updateErr := tx.ExecContext(ctx,
				`UPDATE users SET pin_failed_attempts = $2, pin_locked_until = $3 WHERE id = $1`,
				userID, failedAttempts, nextLock); updateErr != nil {
				return updateErr
			}
			if commitErr := tx.Commit(); commitErr != nil {
				return commitErr
			}
			return errIncorrectPIN
		}
	}
	if mutation.HasKekEnvelopeVersion && mutation.KekEnvelopeVersion != currentVersion {
		return errors.New("key envelope version changed during request")
	}
	now := time.Now().UTC()

	if _, err := tx.ExecContext(ctx, `
		UPDATE users
		SET pin_hash = $2,
		    pin_set_at = $3,
		    private_key_pin_encrypted = $4,
		    private_key_encrypted = CASE WHEN $5 = '' THEN private_key_encrypted ELSE $5 END,
		    pin_failed_attempts = 0,
		    pin_locked_until = NULL,
		    updated_at = $6
		WHERE id = $1`, userID, mutation.PINHash, now,
		mutation.PrivateKeyPinEncrypted, mutation.PrivateKeyEncrypted, now); err != nil {
		return err
	}
	if err := insertAuditTx(ctx, tx, userID, "user.pin_enrolled", map[string]interface{}{
		"password_envelope_repaired": mutation.PrivateKeyEncrypted != "",
		"kek_envelope_version":       currentVersion,
	}, r); err != nil {
		return err
	}
	return tx.Commit()
}
