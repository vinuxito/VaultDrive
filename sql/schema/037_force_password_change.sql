-- Force password change flag
-- Admin can require a user to change their password on next login.
-- The user cannot access the app until they comply.
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE;
