-- +goose Up
ALTER TABLE users ADD COLUMN kek_envelope_version INTEGER NOT NULL DEFAULT 1;
COMMENT ON COLUMN users.kek_envelope_version IS '1=SHA-256 (legacy), 2=Argon2id';

-- +goose Down
ALTER TABLE users DROP COLUMN kek_envelope_version;
