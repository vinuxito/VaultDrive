-- name: CreateFileVersion :one
INSERT INTO file_versions (
  file_id,
  version_number,
  file_size,
  encrypted_path,
  encryption_metadata,
  created_by,
  created_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetFileVersionByID :one
SELECT * FROM file_versions
WHERE id = $1;

-- name: GetFileVersions :many
SELECT * FROM file_versions
WHERE file_id = $1
ORDER BY version_number DESC;

-- name: GetLatestVersion :one
SELECT * FROM file_versions
WHERE file_id = $1
ORDER BY version_number DESC
LIMIT 1;

-- name: GetVersionCount :one
SELECT COUNT(*) FROM file_versions
WHERE file_id = $1;

-- name: DeleteFileVersion :exec
DELETE FROM file_versions
WHERE id = $1;

-- name: DeleteFileVersions :exec
DELETE FROM file_versions WHERE file_id = $1;

-- name: RestoreVersion :one
SELECT * FROM file_versions
WHERE file_id = $1 AND version_number = $2;
