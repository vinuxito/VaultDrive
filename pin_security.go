package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

const (
	pinLockoutThreshold = int32(5)
	pinLockoutWindow    = 15 * time.Minute
)

func isPINLocked(user database.User) bool {
	return user.PinLockedUntil.Valid && user.PinLockedUntil.Time.After(time.Now().UTC())
}

func pinLockedMessage(user database.User) string {
	if !user.PinLockedUntil.Valid {
		return "Too many PIN attempts. Try again later."
	}
	return fmt.Sprintf("Too many PIN attempts. Try again after %s.", user.PinLockedUntil.Time.Local().Format("3:04 PM"))
}

func (cfg *ApiConfig) registerFailedPINAttempt(ctx context.Context, user database.User) (string, error) {
	now := time.Now().UTC()
	shouldLock := user.PinFailedAttempts+1 >= pinLockoutThreshold
	lockUntil := sql.NullTime{}
	if shouldLock {
		lockUntil = sql.NullTime{Time: now.Add(pinLockoutWindow), Valid: true}
	}

	updated, err := cfg.dbQueries.RegisterFailedPINAttempt(ctx, database.RegisterFailedPINAttemptParams{
		ID:                user.ID,
		PinFailedAttempts: pinLockoutThreshold,
		PinLockedUntil:    lockUntil,
		UpdatedAt:         now,
	})
	if err != nil {
		return "", err
	}

	if updated.PinLockedUntil.Valid {
		return fmt.Sprintf("Too many PIN attempts. Try again after %s.", updated.PinLockedUntil.Time.Local().Format("3:04 PM")), nil
	}

	return "Incorrect PIN", nil
}

func (cfg *ApiConfig) resetPINLockout(ctx context.Context, userID uuid.UUID) error {
	return cfg.dbQueries.ResetPINLockout(ctx, database.ResetPINLockoutParams{
		ID:        userID,
		UpdatedAt: time.Now().UTC(),
	})
}
