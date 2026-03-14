-- +goose Up
ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS client_message TEXT;

-- +goose Down
ALTER TABLE upload_tokens DROP COLUMN IF EXISTS client_message;
ALTER TABLE upload_tokens DROP COLUMN IF EXISTS description;
