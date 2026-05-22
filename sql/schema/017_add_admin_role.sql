-- +goose Up
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- NOTE: Admin bootstrap is handled by admin_bootstrap.go at startup, driven by
-- the ADMIN_BOOTSTRAP_EMAILS env var. Historical installations previously had
-- specific emails updated here; those users retain their admin flag. New
-- deployments should set ADMIN_BOOTSTRAP_EMAILS to grant admin access.

-- +goose Down
ALTER TABLE users DROP COLUMN is_admin;
