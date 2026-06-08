-- +goose Up
ALTER TABLE files ADD COLUMN parent_hash VARCHAR(64);

-- +goose Down
ALTER TABLE files DROP COLUMN parent_hash;
