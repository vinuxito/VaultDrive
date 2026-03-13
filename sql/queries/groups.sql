-- name: GetGroupsByUserID :many
SELECT g.*,
       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
       (SELECT COUNT(*) FROM group_file_shares WHERE group_id = g.id) as file_count
FROM groups g
WHERE g.user_id = $1
ORDER BY g.created_at DESC;

-- name: GetGroupsForUser :many
SELECT g.*,
       gm.role,
       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
       (SELECT COUNT(*) FROM group_file_shares WHERE group_id = g.id) as file_count
FROM groups g
JOIN group_members gm ON g.id = gm.group_id
WHERE gm.user_id = $1
ORDER BY g.created_at DESC;

-- name: CreateGroup :one
INSERT INTO groups (user_id, name, description, updated_at)
VALUES ($1, $2, $3, NOW())
RETURNING *;

-- name: UpdateGroup :one
UPDATE groups 
SET name = COALESCE(sqlc.narg('name'), name),
    description = COALESCE(sqlc.narg('description'), description),
    updated_at = NOW()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteGroup :exec
DELETE FROM groups WHERE id = $1 AND user_id = $2;

-- name: GetGroupByID :one
SELECT g.*, 
       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
       (SELECT COUNT(*) FROM group_file_shares WHERE group_id = g.id) as file_count
FROM groups g
WHERE g.id = $1;

-- name: GetGroupMembers :many
SELECT gm.*, 
       u.username, u.email, u.first_name, u.last_name
FROM group_members gm
JOIN users u ON gm.user_id = u.id
WHERE gm.group_id = $1
ORDER BY gm.created_at;

-- name: AddGroupMember :one
INSERT INTO group_members (group_id, user_id, role)
VALUES ($1, $2, $3)
RETURNING *;

-- name: RemoveGroupMember :exec
DELETE FROM group_members 
WHERE group_id = $1 AND user_id = $2;

-- name: ShareFileToGroup :one
INSERT INTO group_file_shares (group_id, file_id, wrapped_key, created_by)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetGroupFiles :many
SELECT f.*,
       gfs.created_at as shared_at,
       u.username as shared_by,
       f.encrypted_metadata
FROM group_file_shares gfs
JOIN files f ON gfs.file_id = f.id
JOIN users u ON gfs.created_by = u.id
WHERE gfs.group_id = $1
ORDER BY gfs.created_at DESC;

-- name: GetFilesSharedViaGroups :many
SELECT DISTINCT f.*,
       g.name as group_name,
       g.id as group_id,
       gfs.created_at as shared_at,
       owner.email as owner_email,
       owner.first_name as owner_first_name,
       owner.last_name as owner_last_name,
       sharer.email as shared_by_email,
       sharer.first_name as shared_by_first_name,
       sharer.last_name as shared_by_last_name
FROM group_file_shares gfs
JOIN files f ON gfs.file_id = f.id
JOIN groups g ON gfs.group_id = g.id
JOIN group_members gm ON gfs.group_id = gm.group_id
JOIN users owner ON f.owner_id = owner.id
JOIN users sharer ON gfs.created_by = sharer.id
WHERE gm.user_id = $1
ORDER BY gfs.created_at DESC;

-- name: RemoveFileFromGroup :exec
DELETE FROM group_file_shares 
WHERE group_id = $1 AND file_id = $2;

-- name: GetGroupsOwner :many
SELECT * FROM groups WHERE user_id = $1 ORDER BY created_at DESC;

-- name: IsUserInGroup :one
SELECT 1 as is_member
FROM group_members
WHERE group_id = $1 AND user_id = $2;

-- name: GetGroupWrappedKeyForUser :one
SELECT gfs.wrapped_key
FROM group_file_shares gfs
JOIN group_members gm ON gfs.group_id = gm.group_id
WHERE gfs.file_id = $1
  AND gm.user_id = $2
LIMIT 1;
