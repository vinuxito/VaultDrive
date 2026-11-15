-- name: SoftDeleteFile :one
UPDATE files
SET deleted_at = $3,
    deleted_by_actor_type = $4,
    deleted_by_key_id = $5,
    deleted_reason = $6,
    updated_at = ($3::timestamptz AT TIME ZONE 'UTC')
WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
RETURNING *;

-- name: GetActiveFolderSubtreeIDs :many
WITH RECURSIVE subtree AS (
  SELECT f0.id
  FROM folders f0
  WHERE f0.id = $1 AND f0.owner_id = $2 AND f0.deleted_at IS NULL
  UNION ALL
  SELECT f.id
  FROM folders f
  INNER JOIN subtree s ON f.parent_id = s.id
  WHERE f.owner_id = $2 AND f.deleted_at IS NULL
)
SELECT subtree.id FROM subtree;

-- name: SoftDeleteFoldersByIDs :many
UPDATE folders
SET deleted_at = $3,
    deleted_by_actor_type = $4,
    deleted_by_key_id = $5,
    deleted_reason = $6,
    updated_at = ($3::timestamptz AT TIME ZONE 'UTC')
WHERE owner_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteFilesByFolderIDs :many
UPDATE files
SET deleted_at = $3,
    deleted_by_actor_type = $4,
    deleted_by_key_id = $5,
    deleted_reason = $6,
    updated_at = ($3::timestamptz AT TIME ZONE 'UTC')
WHERE owner_id = $1 AND folder_id = ANY($2::uuid[]) AND deleted_at IS NULL
RETURNING *;

-- name: ListTrashedFilesByOwner :many
SELECT
  f.id,
  f.owner_id,
  f.filename,
  f.file_path,
  f.file_size,
  f.encrypted_metadata,
  f.current_key_version,
  f.created_at,
  f.updated_at,
  f.folder_id,
  f.deleted_at,
  f.deleted_by_actor_type,
  f.deleted_by_key_id,
  f.deleted_reason,
  ak.name AS deleted_by_key_name,
  ak.key_prefix AS deleted_by_key_prefix
FROM files f
LEFT JOIN agent_api_keys ak ON f.deleted_by_key_id = ak.id
WHERE f.owner_id = $1 AND f.deleted_at IS NOT NULL
ORDER BY f.deleted_at DESC;

-- name: ListTrashedFoldersByOwner :many
SELECT
  fol.id,
  fol.owner_id,
  fol.name,
  fol.parent_id,
  fol.created_at,
  fol.updated_at,
  fol.deleted_at,
  fol.deleted_by_actor_type,
  fol.deleted_by_key_id,
  fol.deleted_reason,
  ak.name AS deleted_by_key_name,
  ak.key_prefix AS deleted_by_key_prefix
FROM folders fol
LEFT JOIN agent_api_keys ak ON fol.deleted_by_key_id = ak.id
WHERE fol.owner_id = $1 AND fol.deleted_at IS NOT NULL
ORDER BY fol.deleted_at DESC;

-- name: GetTrashedFileByIDForOwner :one
SELECT * FROM files
WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL;

-- name: GetTrashedFolderByIDForOwner :one
SELECT * FROM folders
WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL;

-- name: RestoreTrashedFile :one
UPDATE files
SET folder_id = CASE
      WHEN files.folder_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM folders fol WHERE fol.id = files.folder_id AND fol.deleted_at IS NULL
      ) THEN files.folder_id
      ELSE NULL
    END,
    deleted_at = NULL,
    deleted_by_actor_type = NULL,
    deleted_by_key_id = NULL,
    deleted_reason = NULL,
    updated_at = $3
WHERE files.id = $1 AND files.owner_id = $2 AND files.deleted_at IS NOT NULL
RETURNING *;

-- name: GetTrashedFolderSubtreeIDs :many
WITH RECURSIVE subtree AS (
  SELECT f0.id
  FROM folders f0
  WHERE f0.id = $1 AND f0.owner_id = $2 AND f0.deleted_at IS NOT NULL
  UNION ALL
  SELECT f.id
  FROM folders f
  INNER JOIN subtree s ON f.parent_id = s.id
  WHERE f.owner_id = $2 AND f.deleted_at IS NOT NULL
)
SELECT subtree.id FROM subtree;

-- name: RestoreTrashedRootFolder :one
UPDATE folders
SET parent_id = CASE
      WHEN folders.parent_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM folders p WHERE p.id = folders.parent_id AND p.deleted_at IS NULL
      ) THEN folders.parent_id
      ELSE NULL
    END,
    deleted_at = NULL,
    deleted_by_actor_type = NULL,
    deleted_by_key_id = NULL,
    deleted_reason = NULL,
    updated_at = $3
WHERE folders.id = $1 AND folders.owner_id = $2 AND folders.deleted_at IS NOT NULL
RETURNING *;

-- name: RestoreTrashedFoldersByIDs :many
UPDATE folders
SET deleted_at = NULL,
    deleted_by_actor_type = NULL,
    deleted_by_key_id = NULL,
    deleted_reason = NULL,
    updated_at = $3
WHERE owner_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NOT NULL
RETURNING *;

-- name: RestoreTrashedFilesByFolderIDs :many
UPDATE files
SET deleted_at = NULL,
    deleted_by_actor_type = NULL,
    deleted_by_key_id = NULL,
    deleted_reason = NULL,
    updated_at = $3
WHERE owner_id = $1 AND folder_id = ANY($2::uuid[]) AND deleted_at IS NOT NULL
RETURNING *;

-- name: GetAnyFolderSubtreeIDsForOwner :many
WITH RECURSIVE subtree AS (
  SELECT f0.id
  FROM folders f0
  WHERE f0.id = $1 AND f0.owner_id = $2
  UNION ALL
  SELECT f.id
  FROM folders f
  INNER JOIN subtree s ON f.parent_id = s.id
  WHERE f.owner_id = $2
)
SELECT subtree.id FROM subtree;

-- name: ListAllFilesInFolderIDsForOwner :many
SELECT * FROM files
WHERE owner_id = $1 AND folder_id = ANY($2::uuid[]);

-- name: DeleteTrashedFilePermanent :one
DELETE FROM files
WHERE id = $1 AND owner_id = $2 AND deleted_at IS NOT NULL
RETURNING file_path;

-- name: DeleteFilesByIDsForOwnerPermanent :many
DELETE FROM files
WHERE owner_id = $1 AND id = ANY($2::uuid[])
RETURNING file_path;

-- name: DeleteFoldersByIDsForOwnerPermanent :exec
DELETE FROM folders
WHERE owner_id = $1 AND id = ANY($2::uuid[]);
