-- name: CreateAuditLog :one
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata,
  ip_address,
  created_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetAuditLogByID :one
SELECT * FROM audit_logs
WHERE id = $1;

-- name: GetAuditLogsByUser :many
SELECT * FROM audit_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: GetAuditLogsByAction :many
SELECT * FROM audit_logs
WHERE user_id = $1 AND action = $2
ORDER BY created_at DESC
LIMIT $3;

-- name: GetAuditLogsByResource :many
SELECT * FROM audit_logs
WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3
ORDER BY created_at DESC;

-- name: GetRecentAuditLogs :many
SELECT * FROM audit_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetAuditLogsByDateRange :many
SELECT * FROM audit_logs
WHERE user_id = $1 AND created_at BETWEEN $2 AND $3
ORDER BY created_at DESC;

-- name: GetAuditLogCount :one
SELECT COUNT(*) FROM audit_logs
WHERE user_id = $1;

-- name: DeleteAuditLogsBefore :exec
DELETE FROM audit_logs
WHERE user_id = $1 AND created_at < $2;
