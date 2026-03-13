-- +goose Up
-- Add PIN-encrypted private key column so users can decrypt their RSA private key with their PIN
-- This enables PIN-only decryption of shared files without sharing credentials
ALTER TABLE users ADD COLUMN IF NOT EXISTS private_key_pin_encrypted TEXT;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS private_key_pin_encrypted;
