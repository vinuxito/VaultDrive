-- +goose Up
UPDATE users SET is_admin = TRUE WHERE email = 'v.cazares@abrn.mx';

-- +goose Down
UPDATE users SET is_admin = FALSE WHERE email = 'v.cazares@abrn.mx';
