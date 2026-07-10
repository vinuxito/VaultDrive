# Step 6: Collaborative File Uploads

Adapt file upload routines to inherit folder-level encryption parameters when uploading inside a shared folder.

## Rules

1. **Upload Target Evaluation**:
   - Check if the current directory is a shared folder.
   - If yes, read the symmetric Folder Key ($K_f$) from `SessionVaultContext`.

2. **File Encrypt**:
   - Instead of generating a password-stretched file key or private key envelope, wrap the file's encryption key with $K_f$ and upload the resulting wrapped metadata.
   - This ensures all active users containing the $K_f$ folder key envelope can read any file uploaded by any member.
