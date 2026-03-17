-- +goose Up
ALTER TABLE upload_tokens
  ADD COLUMN seal_after_upload BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN last_used_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE upload_tokens
  DROP COLUMN IF EXISTS seal_after_upload,
  DROP COLUMN IF EXISTS last_used_at;
