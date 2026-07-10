# Session Memory: Multi-User ZK Shared Folders & Key Exchange (2026-07-10)

## Context & Objectives
To enable zero-knowledge group workspace collaboration in ABRN-Drive without letting the server ever read file content or folder keys:
1. **Zero-Knowledge Key Exchange**: Securely wrap symmetric Folder Keys with recipient RSA public keys and store envelope keys on the backend.
2. **Collaborator Management UI**: Design a gorgeous modal to invite colleagues, autocomplete user searches, show active members, and revoke access.
3. **Collaborative Read/Write**: Recipient flow automatically fetches and decrypts shared folders, listing and decrypting contents. Uploads inside shared folders inherit folder encryption by wrapping file keys with the shared folder key.

---

## 🛠️ Work Accomplished

### 1. Database Schema & Queries
*   **Goose Migration**: Created [049_folder_shares.sql](file:///lamp/www/ABRN-Drive/sql/schema/049_folder_shares.sql) migration defining the `folder_shares` table with indices.
*   **SQLC wrappers**: Created [folder_shares.sql](file:///lamp/www/ABRN-Drive/sql/queries/folder_shares.sql) queries and generated type-safe database queries.

### 2. Backend Controllers
*   **REST API**: Implemented endpoints in [handle_folder_shares.go](file:///lamp/www/ABRN-Drive/handle_folder_shares.go) for listing folder shares, inviting collaborators, and revoking collaborator shares.
*   **List folder files**: Implemented `GET /api/folders/{id}/files` to safely list files inside folders if the user is the owner or an active collaborator.
*   **Upload & Download Validation**: Integrated secure check checks in [handle_files.go](file:///lamp/www/ABRN-Drive/handle_files.go) and [handle_file_download.go](file:///lamp/www/ABRN-Drive/handle_file_download.go) validating write/read permissions inside shared folders.

### 3. Cryptographic Key Exchange & Clientside Helpers
*   **Multi-user wrapping**: Built [folder-share-multiuser.ts](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/utils/folder-share-multiuser.ts) to wrap AES-GCM folder keys with recipient public keys.
*   **Session caching**: Extended `SessionVaultContext` to cache derived symmetric folder keys.
*   **Upload wrapping**: Adapted file upload procedures in `performUpload` and `performUploadFileToFolder` to wrap file encryption keys with the parent Folder Key using AES-GCM wrapping.
*   **Unwrapping download**: Modified `downloadFileWithCredential` to recover and unwrap file keys using the cached Folder Key.

### 4. Interactive Collaborators UI
*   **Collaborators Modal**: Built `FolderCollaboratorsModal.tsx` displaying active collaborators, autocompleting user searches, and wrapping folder keys for new shares.
*   **Navigation & Grid**: Linked folders shared with the user into "Shared with Me" sidebar section, rendering a premium folder card grid, and prompting PIN/password unlock for private key decryption on folder click.

---

## 🛋️ Verification Results
*   **Go Backend Build**: Clean compilation.
*   **Vite Production Bundle**: Client built successfully in 36s with zero errors or warnings.
