-- +goose Up
CREATE TABLE IF NOT EXISTS refresh_tokens (
	token TEXT PRIMARY KEY,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	revoked_at TIMESTAMP,
	user_id UUID NOT NULL,
	expires_at TIMESTAMP NOT NULL,
	FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- +goose Down
DROP TABLE refresh_tokens;