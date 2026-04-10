-- +goose Up
ALTER TABLE upload_tokens ADD COLUMN IF NOT EXISTS checklist_items JSONB NOT NULL DEFAULT '[]';

-- +goose Down
ALTER TABLE upload_tokens DROP COLUMN IF EXISTS checklist_items;
