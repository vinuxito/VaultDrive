-- name: RegisterPlugin :one
INSERT INTO plugins_manifest (
  owner_id,
  name,
  version,
  manifest,
  is_enabled,
  created_at,
  updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetPluginByID :one
SELECT * FROM plugins_manifest
WHERE id = $1;

-- name: GetPluginByNameVersion :one
SELECT * FROM plugins_manifest
WHERE owner_id = $1 AND name = $2 AND version = $3;

-- name: GetPluginsByOwner :many
SELECT * FROM plugins_manifest
WHERE owner_id = $1
ORDER BY name ASC;

-- name: GetEnabledPlugins :many
SELECT * FROM plugins_manifest
WHERE owner_id = $1 AND is_enabled = true
ORDER BY name ASC;

-- name: UpdatePlugin :one
UPDATE plugins_manifest
SET manifest = $2,
    is_enabled = $3,
    updated_at = $4
WHERE id = $1 AND owner_id = $5
RETURNING *;

-- name: EnablePlugin :one
UPDATE plugins_manifest
SET is_enabled = true,
    updated_at = $2
WHERE id = $1 AND owner_id = $3
RETURNING *;

-- name: DisablePlugin :one
UPDATE plugins_manifest
SET is_enabled = false,
    updated_at = $2
WHERE id = $1 AND owner_id = $3
RETURNING *;

-- name: DeletePlugin :exec
DELETE FROM plugins_manifest
WHERE id = $1 AND owner_id = $2;
