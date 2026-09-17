-- +goose Up
-- Recovery configuration is durable. Recovery attempts and decrypted shares are
-- short-lived, request-bound state and must never reuse the configuration row.
UPDATE account_recovery_shares
SET status = 'configured', decrypted_share_part = NULL, updated_at = NOW();

ALTER TABLE account_recovery_shares
  ALTER COLUMN status SET DEFAULT 'configured';

CREATE TABLE account_recovery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability_hash CHAR(64) NOT NULL UNIQUE,
  verification_code VARCHAR(12) NOT NULL,
  threshold INT NOT NULL CHECK (threshold > 0),
  status VARCHAR(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'consumed', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX idx_recovery_attempts_one_active_user
  ON account_recovery_attempts(user_id)
  WHERE status = 'active';
CREATE INDEX idx_recovery_attempts_expiry
  ON account_recovery_attempts(expires_at)
  WHERE status = 'active';

CREATE TABLE account_recovery_attempt_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES account_recovery_attempts(id) ON DELETE CASCADE,
  recovery_share_id UUID NOT NULL REFERENCES account_recovery_shares(id) ON DELETE CASCADE,
  custodian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_index SMALLINT NOT NULL CHECK (share_index > 0),
  challenge VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved')),
  decrypted_share_part TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, custodian_id),
  UNIQUE(attempt_id, recovery_share_id),
  UNIQUE(attempt_id, share_index),
  CHECK (
    (status = 'pending' AND decrypted_share_part IS NULL AND approved_at IS NULL)
    OR
    (status = 'approved' AND decrypted_share_part IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX idx_recovery_attempt_approvals_custodian
  ON account_recovery_attempt_approvals(custodian_id, status);

-- +goose Down
DROP TABLE IF EXISTS account_recovery_attempt_approvals;
DROP TABLE IF EXISTS account_recovery_attempts;
ALTER TABLE account_recovery_shares ALTER COLUMN status SET DEFAULT 'pending';
