-- name: CreateUploadToken :one
INSERT INTO upload_tokens (
    token,
    owner_user_id,
    target_folder_id,
    expires_at,
    max_files,
    files_uploaded,
    used,
    created_at,
    password_hash,
    raw_encryption_key,
    link_name,
    pin_wrapped_key
)
VALUES ($1, $2, $3, $4, $5, 0, FALSE, NOW(), $6, $7, $8, $9)
RETURNING *;

-- name: GetUploadTokenByToken :one
SELECT * FROM upload_tokens
WHERE token = $1;

-- name: IncrementTokenFileCount :one
UPDATE upload_tokens
SET files_uploaded = files_uploaded + 1
WHERE id = $1
RETURNING *;

-- name: MarkTokenUsed :one
UPDATE upload_tokens
SET used = TRUE
WHERE id = $1
RETURNING *;

-- name: ExpireToken :one
UPDATE upload_tokens
SET expires_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteUploadToken :exec
DELETE FROM upload_tokens
WHERE id = $1;

-- name: ListUploadTokensByOwner :many
SELECT * FROM upload_tokens
WHERE owner_user_id = $1
ORDER BY created_at DESC;

-- name: GetUploadTokenByID :one
SELECT * FROM upload_tokens
WHERE id = $1;

-- name: ClearDropSourceFromFiles :exec
UPDATE files SET drop_source_id = NULL WHERE drop_source_id = $1;

-- name: GetFilesByDropToken :many
SELECT
    f.id,
    f.filename,
    f.file_size,
    f.created_at,
    u.token as drop_token,
    fol.name as folder_name
FROM files f
INNER JOIN upload_tokens u ON f.drop_source_id = u.id
INNER JOIN folders fol ON u.target_folder_id = fol.id
WHERE u.token = $1
ORDER BY f.created_at DESC;
