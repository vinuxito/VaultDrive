-- +goose Up
ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS link_name TEXT;

-- +goose Down
ALTER TABLE upload_tokens DROP COLUMN IF EXISTS link_name;
