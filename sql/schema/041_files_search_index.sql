-- +goose Up
-- Enable trigram extension for fast fuzzy/ILIKE searches on file names.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING gin(filename gin_trgm_ops);

-- +goose Down
DROP INDEX IF EXISTS idx_files_name_trgm;
