-- name: AddTagToFile :one
INSERT INTO file_tags (file_id, tag_id, created_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: RemoveTagFromFile :exec
DELETE FROM file_tags
WHERE file_id = $1 AND tag_id = $2;

-- name: GetTagsForFile :many
SELECT t.* FROM tags t
INNER JOIN file_tags ft ON t.id = ft.tag_id
WHERE ft.file_id = $1
ORDER BY t.name ASC;

-- name: GetFilesWithTag :many
SELECT f.* FROM files f
INNER JOIN file_tags ft ON f.id = ft.file_id
WHERE ft.tag_id = $1 AND f.owner_id = $2
ORDER BY f.created_at DESC;

-- name: GetFileTags :many
SELECT t.* FROM tags t
INNER JOIN file_tags ft ON t.id = ft.tag_id
WHERE ft.file_id = $1;

-- name: DeleteFileTags :exec
DELETE FROM file_tags WHERE file_id = $1;

-- name: DeleteTagFromAllFiles :exec
DELETE FROM file_tags WHERE tag_id = $1;
