# Step 2: Backend API Endpoints

Implement REST endpoints on the Go controller to register and manage folder shares.

## Endpoints

1. **`POST /api/folders/{id}/shares`**:
   - Expects JSON request payload: `{ "user_id": "UUID", "wrapped_key": "string" }`.
   - Validates that the current user owns the folder.
   - Saves the share to the database.

2. **`GET /api/folders/shared`**:
   - Retrieves all folders shared with the current user.
   - Returns details of the folder and the corresponding `wrapped_key` envelope.

3. **`DELETE /api/folders/{id}/shares/{userId}`**:
   - Revokes access for a specific user from the folder.
   - Deletes the share row.

## Tests
- Build test requests under `folder_shares_test.go` checking owner validation checks and envelope persistence.
