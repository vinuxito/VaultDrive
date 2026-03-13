-- +goose Up
ALTER TABLE upload_tokens
  ADD COLUMN pin_wrapped_key TEXT;

-- +goose Down
ALTER TABLE upload_tokens
  DROP COLUMN IF EXISTS pin_wrapped_key;
