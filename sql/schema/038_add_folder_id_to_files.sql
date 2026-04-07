-- +goose Up
ALTER TABLE files ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX idx_files_folder_id ON files(folder_id);

-- +goose Down
DROP INDEX IF EXISTS idx_files_folder_id;
ALTER TABLE files DROP COLUMN IF EXISTS folder_id;
