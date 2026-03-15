-- +goose Up
CREATE TABLE IF NOT EXISTS agent_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix VARCHAR(24) NOT NULL,
    key_hash CHAR(64) NOT NULL UNIQUE,
    scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by_ip TEXT,
    last_used_ip TEXT,
    last_used_user_agent TEXT,
    notes TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_seen_context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT chk_agent_api_keys_status CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_agent_api_keys_user_id ON agent_api_keys(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_status ON agent_api_keys(status);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_expires_at ON agent_api_keys(expires_at);

-- +goose Down
DROP TABLE IF EXISTS agent_api_keys;
