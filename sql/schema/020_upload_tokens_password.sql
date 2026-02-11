-- +goose Up
-- Add password_hash column to upload_tokens for owner-set encryption passwords

ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- +goose Down
ALTER TABLE upload_tokens DROP COLUMN IF EXISTS password_hash;
