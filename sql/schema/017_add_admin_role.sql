-- +goose Up
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Set filemon@abrn.mx as admin
UPDATE users SET is_admin = TRUE WHERE email = 'filemon@abrn.mx';

-- +goose Down
ALTER TABLE users DROP COLUMN is_admin;
