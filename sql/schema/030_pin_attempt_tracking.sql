-- +goose Up
ALTER TABLE users
  ADD COLUMN pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN pin_locked_until TIMESTAMPTZ;

-- +goose Down
ALTER TABLE users
  DROP COLUMN IF EXISTS pin_failed_attempts,
  DROP COLUMN IF EXISTS pin_locked_until;
