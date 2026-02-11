-- name: GetFileDropSource :one
SELECT 
    f.id,
    f.filename,
    u.token,
    fol.name as folder_name
FROM files f
INNER JOIN upload_tokens u ON f.drop_source_id = u.id
INNER JOIN folders fol ON u.target_folder_id = fol.id
WHERE f.id = $1;