-- +goose Up
ALTER TABLE files ADD COLUMN starred BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_files_starred ON files(owner_id, starred) WHERE starred = TRUE;

-- +goose Down
DROP INDEX IF EXISTS idx_files_starred;
ALTER TABLE files DROP COLUMN starred;
