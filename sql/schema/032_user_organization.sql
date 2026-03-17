-- +goose Up
ALTER TABLE users
  ADD COLUMN organization_name TEXT;

-- +goose Down
ALTER TABLE users
  DROP COLUMN IF EXISTS organization_name;
