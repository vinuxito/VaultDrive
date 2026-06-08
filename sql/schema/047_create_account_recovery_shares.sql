-- +goose Up
ALTER TABLE users ADD COLUMN recovery_threshold INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS account_recovery_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  custodian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wrapped_share_payload TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  decrypted_share_part TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE(user_id, custodian_id)
);

-- +goose Down
DROP TABLE IF EXISTS account_recovery_shares;
ALTER TABLE users DROP COLUMN recovery_threshold;
