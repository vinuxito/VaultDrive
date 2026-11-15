-- +goose Up
ALTER TABLE agent_api_keys
  ADD COLUMN IF NOT EXISTS allowed_folder_ids JSONB,
  ADD COLUMN IF NOT EXISTS allowed_ips JSONB,
  ADD COLUMN IF NOT EXISTS rate_limit_rpm INTEGER NOT NULL DEFAULT 60;

CREATE TABLE IF NOT EXISTS agent_idempotency_records (
  key_scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key_scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_idempotency_expires_at
  ON agent_idempotency_records(expires_at);

-- +goose Down
DROP INDEX IF EXISTS idx_agent_idempotency_expires_at;
DROP TABLE IF EXISTS agent_idempotency_records;

ALTER TABLE agent_api_keys
  DROP COLUMN IF EXISTS rate_limit_rpm,
  DROP COLUMN IF EXISTS allowed_ips,
  DROP COLUMN IF EXISTS allowed_folder_ids;
