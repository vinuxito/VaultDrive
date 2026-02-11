-- +goose Up
CREATE TABLE IF NOT EXISTS secure_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    encrypted_content TEXT NOT NULL,
    encryption_metadata TEXT NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    last_accessed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secure_notes_owner_id ON secure_notes(owner_id);

-- +goose Down
DROP TABLE IF EXISTS secure_notes;
