-- +goose Up
-- Upload tokens for Secure Drop feature
-- Allows external users to upload files to a specific folder without authentication

CREATE TABLE IF NOT EXISTS upload_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    max_files INTEGER,
    files_uploaded INTEGER DEFAULT 0,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_upload_tokens_token ON upload_tokens(token);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_owner ON upload_tokens(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_folder ON upload_tokens(target_folder_id);

-- +goose Down
DROP TABLE IF EXISTS upload_tokens;
