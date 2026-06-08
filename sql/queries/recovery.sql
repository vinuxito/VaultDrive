-- name: CreateOrUpdateRecoveryShare :one
INSERT INTO account_recovery_shares (
  user_id,
  custodian_id,
  wrapped_share_payload,
  status,
  decrypted_share_part,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (user_id, custodian_id)
DO UPDATE SET
  wrapped_share_payload = EXCLUDED.wrapped_share_payload,
  status = EXCLUDED.status,
  decrypted_share_part = EXCLUDED.decrypted_share_part,
  updated_at = EXCLUDED.updated_at
RETURNING *;

-- name: GetRecoverySharesForUser :many
SELECT * FROM account_recovery_shares
WHERE user_id = $1;

-- name: GetRecoverySharesForUserWithCustodian :many
SELECT 
  s.*,
  u.username AS custodian_username,
  u.email AS custodian_email,
  u.first_name AS custodian_first_name,
  u.last_name AS custodian_last_name
FROM account_recovery_shares s
JOIN users u ON s.custodian_id = u.id
WHERE s.user_id = $1;

-- name: GetRecoveryRequestsForCustodian :many
SELECT 
  s.*,
  u.username AS owner_username,
  u.email AS owner_email,
  u.first_name AS owner_first_name,
  u.last_name AS owner_last_name
FROM account_recovery_shares s
JOIN users u ON s.user_id = u.id
WHERE s.custodian_id = $1 AND s.status = 'pending';

-- name: ApproveRecoveryShare :one
UPDATE account_recovery_shares
SET 
  status = 'approved',
  decrypted_share_part = $3,
  updated_at = $4
WHERE user_id = $1 AND custodian_id = $2
RETURNING *;

-- name: StartRecoveryRequestForUser :exec
UPDATE account_recovery_shares
SET 
  status = 'pending',
  decrypted_share_part = NULL,
  updated_at = $2
WHERE user_id = $1;

-- name: DeleteRecoverySharesForUser :exec
DELETE FROM account_recovery_shares
WHERE user_id = $1;
