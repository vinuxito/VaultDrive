-- +goose Up
CREATE TABLE IF NOT EXISTS file_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    expires_at TIMESTAMP,
    max_file_size BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    uploaded_files JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_requests_owner_id ON file_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_file_requests_token ON file_requests(token);

-- +goose Down
DROP TABLE IF EXISTS file_requests;
