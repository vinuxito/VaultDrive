-- +goose Up
-- Superseded: admin bootstrap is now handled at application startup via
-- admin_bootstrap.go using the ADMIN_BOOTSTRAP_EMAILS env var. This migration
-- is kept as a placeholder so goose history remains linear.
SELECT 1;

-- +goose Down
SELECT 1;
