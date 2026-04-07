-- name: CreateFile :one
INSERT INTO files (
    owner_id,
    filename,
    file_path,
    file_size,
    encrypted_metadata,
    current_key_version,
    created_at,
    updated_at,
    drop_source_id,
    folder_id
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetFileByID :one
SELECT * FROM files
WHERE id = $1;

-- name: GetFilesByOwnerID :many
SELECT * FROM files
WHERE owner_id = $1
ORDER BY created_at DESC;

-- name: UpdateFile :one
UPDATE files
SET 
    filename = $2,
    file_path = $3,
    file_size = $4,
    encrypted_metadata = $5,
    current_key_version = $6,
    updated_at = $7
WHERE id = $1
RETURNING *;

-- name: UpdateFileMetadata :one
UPDATE files
SET 
    encrypted_metadata = $2,
    current_key_version = $3,
    updated_at = $4
WHERE id = $1
RETURNING *;

-- name: DeleteFile :exec
DELETE FROM files
WHERE id = $1;

-- name: DeleteFilesByOwnerID :exec
DELETE FROM files
WHERE owner_id = $1;

-- name: GetFilesByOwnerIDWithPagination :many
SELECT * FROM files
WHERE owner_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountFilesByOwnerID :one
SELECT COUNT(*) FROM files
WHERE owner_id = $1;

-- name: ToggleFileStarred :one
UPDATE files
SET starred = $2,
    updated_at = $3
WHERE id = $1
RETURNING *;

-- name: GetFilesByFolderID :many
SELECT * FROM files
WHERE folder_id = $1
ORDER BY filename ASC;

-- name: UpdateFileFolderID :exec
UPDATE files SET folder_id = $1, updated_at = $2
WHERE id = $3;

-- name: GetFilesByFolderIDs :many
SELECT * FROM files
WHERE folder_id = ANY($1::uuid[])
ORDER BY folder_id, filename ASC;
