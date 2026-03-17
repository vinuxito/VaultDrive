-- +goose Up
ALTER TABLE users
  ADD COLUMN pin_hash TEXT,
  ADD COLUMN pin_set_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE users
  DROP COLUMN IF EXISTS pin_hash,
  DROP COLUMN IF EXISTS pin_set_at;
