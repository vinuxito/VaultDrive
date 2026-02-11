-- name: CreateFileRequest :one
INSERT INTO file_requests (
  owner_id,
  token,
  description,
  expires_at,
  max_file_size,
  is_active,
  uploaded_files,
  created_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetFileRequestByID :one
SELECT * FROM file_requests
WHERE id = $1;

-- name: GetFileRequestByToken :one
SELECT * FROM file_requests
WHERE token = $1 AND is_active = true;

-- name: GetFileRequestsByOwner :many
SELECT * FROM file_requests
WHERE owner_id = $1
ORDER BY created_at DESC;

-- name: UpdateFileRequest :one
UPDATE file_requests
SET description = $2,
    expires_at = $3,
    max_file_size = $4,
    is_active = $5,
    uploaded_files = $6,
    updated_at = $7
WHERE id = $1 AND owner_id = $8
RETURNING *;

-- name: AddUploadedFile :one
UPDATE file_requests
SET uploaded_files = uploaded_files || $2,
    updated_at = $3
WHERE id = $1
RETURNING *;

-- name: RevokeFileRequest :one
UPDATE file_requests
SET is_active = false,
    updated_at = $2
WHERE id = $1 AND owner_id = $3
RETURNING *;

-- name: DeleteFileRequest :exec
DELETE FROM file_requests
WHERE id = $1 AND owner_id = $2;

-- name: GetExpiredRequests :many
SELECT * FROM file_requests
WHERE is_active = true AND expires_at < NOW();
