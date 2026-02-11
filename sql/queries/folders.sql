-- name: CreateFolder :one
INSERT INTO folders (
  owner_id,
  name,
  parent_id,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetFolderByID :one
SELECT * FROM folders
WHERE id = $1;

-- name: GetFoldersByOwner :many
SELECT * FROM folders
WHERE owner_id = $1
ORDER BY name ASC;

-- name: GetFoldersByParent :many
SELECT * FROM folders
WHERE owner_id = $1 AND parent_id = $2
ORDER BY name ASC;

-- name: GetRootFolders :many
SELECT * FROM folders
WHERE owner_id = $1 AND parent_id IS NULL
ORDER BY name ASC;

-- name: UpdateFolder :one
UPDATE folders
SET name = $2, parent_id = $3, updated_at = $4
WHERE id = $1 AND owner_id = $5
RETURNING *;

-- name: DeleteFolder :exec
DELETE FROM folders
WHERE id = $1 AND owner_id = $2;

-- name: GetFolderPath :many
WITH RECURSIVE folder_path AS (
  SELECT folders.id, folders.name, folders.parent_id, 0 as level
  FROM folders
  WHERE folders.id = $1
  
  UNION ALL
  
  SELECT f.id, f.name, f.parent_id, fp.level + 1
  FROM folders f
  INNER JOIN folder_path fp ON f.id = fp.parent_id
)
SELECT folder_path.id, folder_path.name, folder_path.parent_id, folder_path.level
FROM folder_path
ORDER BY level DESC;
