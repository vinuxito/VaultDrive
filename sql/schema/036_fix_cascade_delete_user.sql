-- Fix missing ON DELETE CASCADE/SET NULL for user deletion
-- Without these, deleting a user who has group file shares or file versions fails with FK violation.

-- group_file_shares.created_by: cascade — share record is meaningless without the sharer
ALTER TABLE group_file_shares
  DROP CONSTRAINT IF EXISTS group_file_shares_created_by_fkey,
  ADD CONSTRAINT group_file_shares_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- file_versions.created_by: set null — preserve version history, just lose author reference
ALTER TABLE file_versions
  DROP CONSTRAINT IF EXISTS file_versions_created_by_fkey,
  ADD CONSTRAINT file_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
