-- +goose Up
ALTER TABLE public_share_links
  ADD COLUMN access_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_accessed_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE public_share_links
  DROP COLUMN IF EXISTS access_count,
  DROP COLUMN IF EXISTS last_accessed_at;
