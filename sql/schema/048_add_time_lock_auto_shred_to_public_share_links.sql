-- +goose Up
ALTER TABLE public_share_links
  ADD COLUMN unlock_at TIMESTAMPTZ,
  ADD COLUMN max_downloads INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE public_share_links
  DROP COLUMN IF EXISTS unlock_at,
  DROP COLUMN IF EXISTS max_downloads;
