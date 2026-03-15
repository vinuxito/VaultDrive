-- +goose Up
ALTER TABLE upload_tokens DROP COLUMN IF EXISTS raw_encryption_key;

-- +goose Down
ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS raw_encryption_key TEXT;
