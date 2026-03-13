-- +goose Up
-- Add raw_encryption_key column for password-protected drops
-- This stores the raw 32-byte encryption key used for file encryption
-- The password_hash column stores the wrapped (encrypted) version
ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS raw_encryption_key TEXT;

-- +goose Down
ALTER TABLE upload_tokens DROP COLUMN IF EXISTS raw_encryption_key;
