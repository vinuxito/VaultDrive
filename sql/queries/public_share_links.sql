-- name: CreatePublicShareLink :one
INSERT INTO public_share_links (file_id, owner_id, token, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetPublicShareLinkByToken :one
SELECT * FROM public_share_links
WHERE token = $1 AND is_active = TRUE;

-- name: ListPublicShareLinksByOwner :many
SELECT * FROM public_share_links
WHERE owner_id = $1
ORDER BY created_at DESC;

-- name: RevokePublicShareLink :exec
UPDATE public_share_links
SET is_active = FALSE
WHERE id = $1 AND owner_id = $2;
