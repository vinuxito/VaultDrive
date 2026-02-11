-- +goose Up
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_owner_id ON tags(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_owner_name ON tags(owner_id, name);

-- +goose Down
DROP TABLE IF EXISTS tags;
