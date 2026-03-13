-- name: CreateFileAccessKey :one
INSERT INTO file_access_keys (file_id, user_id, wrapped_key)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetFileAccessKey :one
SELECT * FROM file_access_keys
WHERE file_id = $1 AND user_id = $2;

-- name: DeleteFileAccessKey :exec
DELETE FROM file_access_keys
WHERE file_id = $1 AND user_id = $2;

-- name: GetFileAccessKeysByUser :many
SELECT * FROM file_access_keys
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: GetFileAccessKeysByFile :many
SELECT * FROM file_access_keys
WHERE file_id = $1
ORDER BY created_at DESC;
