-- name: GetAgentIdempotencyRecord :one
SELECT * FROM agent_idempotency_records
WHERE key_scope = $1 AND idempotency_key = $2 AND expires_at > NOW();

-- name: UpsertAgentIdempotencyRecord :exec
INSERT INTO agent_idempotency_records (
  key_scope, idempotency_key, request_hash, status_code, response_body, created_at, expires_at
)
VALUES ($1, $2, $3, $4, $5, NOW(), $6)
ON CONFLICT (key_scope, idempotency_key) DO UPDATE SET
  request_hash = EXCLUDED.request_hash,
  status_code = EXCLUDED.status_code,
  response_body = EXCLUDED.response_body,
  created_at = NOW(),
  expires_at = EXCLUDED.expires_at
WHERE agent_idempotency_records.expires_at <= NOW();

-- name: DeleteExpiredAgentIdempotencyRecords :exec
DELETE FROM agent_idempotency_records
WHERE expires_at <= NOW();

-- name: GetActiveDescendantFolderIDsForOwner :many
WITH RECURSIVE tree AS (
  SELECT f0.id
  FROM folders f0
  WHERE f0.owner_id = $1 AND f0.id = ANY($2::uuid[]) AND f0.deleted_at IS NULL
  UNION ALL
  SELECT f.id
  FROM folders f
  INNER JOIN tree t ON f.parent_id = t.id
  WHERE f.owner_id = $1 AND f.deleted_at IS NULL
)
SELECT tree.id FROM tree;
