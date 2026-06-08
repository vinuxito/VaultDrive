-- +goose Up
CREATE TABLE IF NOT EXISTS upload_link_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    default_message TEXT,
    checklist_items JSONB NOT NULL DEFAULT '[]',
    branding_tag TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_link_templates_user ON upload_link_templates(user_id);

-- +goose Down
DROP TABLE IF EXISTS upload_link_templates;
