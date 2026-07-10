# Step 5: Shared Folder Decryption (Recipient Flow)

Integrate recipient workflows to decrypt folder structures and register symmetric folder keys.

## Actions

1. **Shared Folders Section**:
   - Create a "Shared with Me" sidebar link and folder grid view.
   - On folder select, fetch the folder share payload and extract the `wrapped_key`.

2. **Decryption Flow**:
   - Decrypt the `wrapped_key` using the recipient's private key (`unwrapKeyWithRSA`).
   - If the private key is not unlocked, request user authorization (PIN/Password prompt).
   - Cache the resulting symmetric Folder Key inside `SessionVaultContext` as `setFolderKey(folderId, key)` for subsequent file reads/writes within the folder scope.
