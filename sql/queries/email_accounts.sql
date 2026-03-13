-- name: CreateEmailAccount :one
INSERT INTO email_accounts (
    user_id,
    email,
    imap_host,
    imap_port,
    imap_user,
    encrypted_imap_password
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: GetEmailAccountByID :one
SELECT * FROM email_accounts
WHERE id = $1 AND user_id = $2;

-- name: ListEmailAccountsByUser :many
SELECT * FROM email_accounts
WHERE user_id = $1
ORDER BY email;

-- name: UpdateEmailAccount :one
UPDATE email_accounts
SET
    email = $3,
    imap_host = $4,
    imap_port = $5,
    imap_user = $6,
    encrypted_imap_password = $7,
    updated_at = NOW()
WHERE
    id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteEmailAccount :exec
DELETE FROM email_accounts
WHERE id = $1 AND user_id = $2;
