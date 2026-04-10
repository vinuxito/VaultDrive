-- +goose Up
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS audit_retention_days    INTEGER NOT NULL DEFAULT 365,
    ADD COLUMN IF NOT EXISTS auto_expire_stale_days  INTEGER,          -- NULL = disabled
    ADD COLUMN IF NOT EXISTS failure_alert_threshold INTEGER NOT NULL DEFAULT 3;

-- +goose Down
ALTER TABLE users
    DROP COLUMN IF EXISTS audit_retention_days,
    DROP COLUMN IF EXISTS auto_expire_stale_days,
    DROP COLUMN IF EXISTS failure_alert_threshold;
