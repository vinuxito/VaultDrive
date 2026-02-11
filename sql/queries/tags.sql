-- name: CreateTag :one
INSERT INTO tags (
  owner_id,
  name,
  color,
  created_at
)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetTagByID :one
SELECT * FROM tags
WHERE id = $1;

-- name: GetTagsByOwner :many
SELECT * FROM tags
WHERE owner_id = $1
ORDER BY name ASC;

-- name: GetTagByName :one
SELECT * FROM tags
WHERE owner_id = $1 AND name = $2;

-- name: UpdateTag :one
UPDATE tags
SET name = $2, color = $3
WHERE id = $1 AND owner_id = $4
RETURNING *;

-- name: DeleteTag :exec
DELETE FROM tags
WHERE id = $1 AND owner_id = $2;
