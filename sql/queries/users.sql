-- name: CreateUser :one
INSERT INTO users (
  first_name,
  last_name,
  username,
  email,
  password_hash,
  public_key,
  private_key_encrypted,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users
WHERE email = $1;

-- name: GetUserByUsername :one
SELECT * FROM users
WHERE username = $1;

-- name: UpdateUser :one
UPDATE users
SET 
  first_name = $2,
  last_name = $3,
  email = $4,
  updated_at = $5
WHERE id = $1
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users
WHERE id = $1;

-- Admin queries
-- name: GetAllUsers :many
SELECT * FROM users
ORDER BY created_at DESC;

-- name: UpdateUserAsAdmin :one
UPDATE users
SET
  first_name = $2,
  last_name = $3,
  email = $4,
  username = $5,
  updated_at = $6
WHERE id = $1
RETURNING *;

-- name: UpdateUserPassword :exec
UPDATE users
SET
  password_hash = $2,
  updated_at = $3
WHERE id = $1;

-- name: DeleteUserAsAdmin :exec
DELETE FROM users
WHERE id = $1;

-- User search query
-- name: SearchUsers :many
SELECT id, username, email, first_name, last_name, created_at, updated_at
FROM users
WHERE
  LOWER(username) LIKE LOWER($1) OR
  LOWER(email) LIKE LOWER($1) OR
  LOWER(first_name) LIKE LOWER($1) OR
  LOWER(last_name) LIKE LOWER($1)
ORDER BY created_at DESC
LIMIT $2;