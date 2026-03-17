-- name: InsertActivity :exec
INSERT INTO activity_log (user_id, event_type, payload)
VALUES ($1, $2, $3);

-- name: GetRecentActivitiesForUser :many
SELECT * FROM activity_log
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;
