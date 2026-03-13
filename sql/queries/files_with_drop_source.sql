-- name: GetFilesWithDropSource :many
SELECT
    f.id,
    f.filename,
    f.file_path,
    f.file_size,
    f.starred,
    f.created_at,
    f.updated_at,
    f.encrypted_metadata,
    f.drop_source_id,
    u.token as drop_token,
    u.password_hash as drop_wrapped_key,
    fol.name as drop_folder_name
FROM files f
LEFT JOIN upload_tokens u ON f.drop_source_id = u.id
LEFT JOIN folders fol ON u.target_folder_id = fol.id
WHERE f.owner_id = $1
ORDER BY f.created_at DESC;