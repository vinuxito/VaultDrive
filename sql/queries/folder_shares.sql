-- name: CreateFolderShare :one
INSERT INTO folder_shares (folder_id, user_id, wrapped_key, shared_by, created_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetFolderShare :one
SELECT * FROM folder_shares
WHERE folder_id = $1 AND user_id = $2;

-- name: DeleteFolderShare :exec
DELETE FROM folder_shares
WHERE folder_id = $1 AND user_id = $2;

-- name: ListFolderSharesForFolder :many
SELECT * FROM folder_shares
WHERE folder_id = $1;

-- name: ListFoldersSharedWithUser :many
SELECT f.*, fs.wrapped_key, fs.shared_by, fs.created_at as shared_at FROM folders f
INNER JOIN folder_shares fs ON f.id = fs.folder_id
WHERE fs.user_id = $1
ORDER BY fs.created_at DESC;
