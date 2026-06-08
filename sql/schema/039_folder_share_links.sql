-- +goose Up
CREATE TABLE folder_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE folder_share_file_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_share_link_id UUID NOT NULL REFERENCES folder_share_links(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    wrapped_file_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(folder_share_link_id, file_id)
);

CREATE INDEX idx_folder_share_links_token ON folder_share_links(token);
CREATE INDEX idx_folder_share_links_owner ON folder_share_links(owner_id);
CREATE INDEX idx_folder_share_links_folder ON folder_share_links(folder_id);
CREATE INDEX idx_folder_share_file_keys_link ON folder_share_file_keys(folder_share_link_id);

-- +goose Down
DROP TABLE IF EXISTS folder_share_file_keys;
DROP TABLE IF EXISTS folder_share_links;
