-- name: CreateSecureNote :one
INSERT INTO secure_notes (
  owner_id,
  title,
  encrypted_content,
  encryption_metadata,
  is_locked,
  last_accessed_at,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetSecureNoteByID :one
SELECT * FROM secure_notes
WHERE id = $1;

-- name: GetSecureNotesByOwner :many
SELECT * FROM secure_notes
WHERE owner_id = $1
ORDER BY updated_at DESC;

-- name: UpdateSecureNote :one
UPDATE secure_notes
SET title = $2,
    encrypted_content = $3,
    encryption_metadata = $4,
    is_locked = $5,
    updated_at = $6
WHERE id = $1 AND owner_id = $7
RETURNING *;

-- name: UpdateNoteLock :one
UPDATE secure_notes
SET is_locked = $2,
    last_accessed_at = $3,
    updated_at = $4
WHERE id = $1 AND owner_id = $5
RETURNING *;

-- name: UpdateNoteAccess :exec
UPDATE secure_notes
SET last_accessed_at = $2
WHERE id = $1;

-- name: DeleteSecureNote :exec
DELETE FROM secure_notes
WHERE id = $1 AND owner_id = $2;

-- name: SearchSecureNotes :many
SELECT * FROM secure_notes
WHERE owner_id = $1 AND title ILIKE $2
ORDER BY updated_at DESC;
