-- +goose Up
ALTER TABLE files ADD COLUMN IF NOT EXISTS drop_source_id UUID REFERENCES upload_tokens(id);

-- +goose Down
ALTER TABLE files DROP COLUMN IF EXISTS drop_source_id;
