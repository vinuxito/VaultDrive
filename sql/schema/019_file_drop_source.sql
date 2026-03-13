-- Add drop_source_id to files table to track upload source
-- name: 019_file_drop_source :one
ALTER TABLE files ADD COLUMN drop_source_id UUID REFERENCES upload_tokens(id);