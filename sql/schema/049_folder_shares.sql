-- +goose Up
CREATE TABLE folder_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wrapped_key TEXT NOT NULL,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(folder_id, user_id)
);

CREATE INDEX idx_folder_shares_folder_id ON folder_shares(folder_id);
CREATE INDEX idx_folder_shares_user_id ON folder_shares(user_id);

-- +goose Down
DROP TABLE IF EXISTS folder_shares;
