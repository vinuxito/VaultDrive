-- name: CreateAgentAPIKey :one
INSERT INTO agent_api_keys (
  user_id,
  name,
  key_prefix,
  key_hash,
  scopes_json,
  status,
  created_by_ip,
  expires_at,
  notes,
  usage_count,
  last_seen_context_json
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: ListAgentAPIKeysByUser :many
SELECT * FROM agent_api_keys
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetAgentAPIKeyByHash :one
SELECT * FROM agent_api_keys
WHERE key_hash = $1;

-- name: GetAgentAPIKeyByIDForUser :one
SELECT * FROM agent_api_keys
WHERE id = $1 AND user_id = $2;

-- name: RevokeAgentAPIKey :one
UPDATE agent_api_keys
SET status = 'revoked',
    revoked_at = $3
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: MarkAgentAPIKeyUsed :one
UPDATE agent_api_keys
SET last_used_at = $2,
    last_used_ip = $3,
    last_used_user_agent = $4,
    usage_count = usage_count + 1,
    last_seen_context_json = $5
WHERE id = $1
RETURNING *;

-- name: MarkAgentAPIKeyExpired :one
UPDATE agent_api_keys
SET status = 'expired'
WHERE id = $1
RETURNING *;
