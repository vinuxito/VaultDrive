-- name: CreateFolderShareLink :one
INSERT INTO folder_share_links (folder_id, owner_id, token, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetFolderShareLinkByToken :one
SELECT * FROM folder_share_links
WHERE token = $1 AND is_active = TRUE;

-- name: ListFolderShareLinksByOwner :many
SELECT * FROM folder_share_links
WHERE owner_id = $1
ORDER BY created_at DESC;

-- name: ListFolderShareLinksByFolder :many
SELECT * FROM folder_share_links
WHERE folder_id = $1 AND owner_id = $2
ORDER BY created_at DESC;

-- name: RevokeFolderShareLink :exec
UPDATE folder_share_links
SET is_active = FALSE
WHERE id = $1 AND owner_id = $2;

-- name: IncrementFolderShareLinkAccess :exec
UPDATE folder_share_links
SET access_count = access_count + 1, last_accessed_at = NOW()
WHERE token = $1;

-- name: CreateFolderShareFileKey :exec
INSERT INTO folder_share_file_keys (folder_share_link_id, file_id, wrapped_file_key)
VALUES ($1, $2, $3);

-- name: GetFolderShareFileKeys :many
SELECT * FROM folder_share_file_keys
WHERE folder_share_link_id = $1;

-- name: GetFolderShareFileKeyByFile :one
SELECT * FROM folder_share_file_keys
WHERE folder_share_link_id = $1 AND file_id = $2;
