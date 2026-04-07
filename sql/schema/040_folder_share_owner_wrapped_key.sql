-- +goose Up
ALTER TABLE folder_share_links
  ADD COLUMN owner_wrapped_folder_key TEXT;

-- +goose Down
ALTER TABLE folder_share_links
  DROP COLUMN IF EXISTS owner_wrapped_folder_key;
