-- +goose Up
CREATE TABLE IF NOT EXISTS file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES files(id) ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    file_size BIGINT NOT NULL,
    encrypted_path TEXT NOT NULL,
    encryption_metadata TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_file_version ON file_versions(file_id, version_number);

-- +goose Down
DROP TABLE IF EXISTS file_versions;
