-- +goose Up
CREATE TABLE IF NOT EXISTS plugins_manifest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    manifest JSONB NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugins_manifest_owner_id ON plugins_manifest(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugins_manifest_name_version ON plugins_manifest(owner_id, name, version);

-- +goose Down
DROP TABLE IF EXISTS plugins_manifest;
