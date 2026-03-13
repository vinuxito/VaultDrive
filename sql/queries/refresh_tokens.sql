-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (
    token,
    created_at,
    updated_at,
    user_id,
    expires_at,
    revoked_at
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING token, created_at, updated_at, revoked_at, user_id, expires_at;

-- name: GetRefreshToken :one
SELECT token, created_at, updated_at, revoked_at, user_id, expires_at FROM refresh_tokens
WHERE token = $1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens
SET revoked_at = $2, updated_at = $3
WHERE token = $1;

-- name: GetUserByRefreshToken :one
SELECT users.id, users.first_name, users.last_name, users.username, users.email, users.password_hash, users.public_key, users.private_key_encrypted, users.created_at, users.updated_at FROM users
JOIN refresh_tokens ON users.id = refresh_tokens.user_id
WHERE refresh_tokens.token = $1;

