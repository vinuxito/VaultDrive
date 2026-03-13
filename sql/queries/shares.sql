-- name: CreateShare :one
INSERT INTO file_shares (file_id, shared_with_user_id, wrapped_key, created_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetSharesByFileID :many
SELECT * FROM file_shares
WHERE file_id = $1;

-- name: GetFilesBySharedWithUser :many
SELECT f.* FROM files f
INNER JOIN file_shares fs ON f.id = fs.file_id
WHERE fs.shared_with_user_id = $1
ORDER BY f.created_at DESC;

-- name: DeleteShare :exec
DELETE FROM file_shares
WHERE file_id = $1 AND shared_with_user_id = $2;

-- name: GetShareByFileAndUser :one
SELECT * FROM file_shares
WHERE file_id = $1 AND shared_with_user_id = $2;