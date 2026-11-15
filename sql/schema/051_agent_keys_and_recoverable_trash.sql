-- +goose Up
ALTER TABLE agent_api_keys
  ADD COLUMN IF NOT EXISTS key_kind TEXT NOT NULL DEFAULT 'standard'
  CHECK (key_kind IN ('standard', 'delete_only'));

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_actor_type TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by_key_id UUID REFERENCES agent_api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_files_active_owner
  ON files(owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_trash_owner
  ON files(owner_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE folders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_actor_type TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by_key_id UUID REFERENCES agent_api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_folders_active_owner
  ON folders(owner_id, name ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_trash_owner
  ON folders(owner_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_folders_trash_owner;
DROP INDEX IF EXISTS idx_folders_active_owner;
ALTER TABLE folders
  DROP COLUMN IF EXISTS deleted_reason,
  DROP COLUMN IF EXISTS deleted_by_key_id,
  DROP COLUMN IF EXISTS deleted_by_actor_type,
  DROP COLUMN IF EXISTS deleted_at;

DROP INDEX IF EXISTS idx_files_trash_owner;
DROP INDEX IF EXISTS idx_files_active_owner;
ALTER TABLE files
  DROP COLUMN IF EXISTS deleted_reason,
  DROP COLUMN IF EXISTS deleted_by_key_id,
  DROP COLUMN IF EXISTS deleted_by_actor_type,
  DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE agent_api_keys
  DROP COLUMN IF EXISTS key_kind;
