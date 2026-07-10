# Step 1: Database Schema Migration

Create the SQL schema migration file to declare the `folder_shares` table and compile database queries.

## Requirements

1. **Schema Definition**:
   - Create a table `folder_shares` linking `folder_id` and `user_id`.
   - Store the `wrapped_key` (TEXT) envelope representing the folder's symmetric key wrapped with the recipient's RSA public key.
   - Store `shared_by` (UUID) indicating the user who issued the share.
   - Establish proper cascade rules and a unique constraint on `(folder_id, user_id)` to avoid duplicate shares.

2. **Migration Execution**:
   - Save the migration script under `sql/schema/007_folder_shares.sql` or similar numbering.
   - Apply the migration to the PostgreSQL instance.

3. **Database Queries**:
   - Generate database CRUD queries in `sql/queries/folder_shares.sql` for:
     - `CreateFolderShare`
     - `GetFolderShare`
     - `DeleteFolderShare`
     - `ListFolderSharesForFolder`
     - `ListFoldersSharedWithUser`
   - Run `sqlc generate` (or equivalent tool) to update database wrappers.
