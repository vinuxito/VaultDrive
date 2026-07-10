# Step 3: Cryptographic Key-Wrapping Helpers

Build client-side cryptographic helpers to execute the hybrid folder key wrapping workflow in the browser.

## Logic

1. **Get Public Key**:
   - Create api helper `getUserPublicKey(userId)` to fetch the user's RSA public key PEM string.

2. **Wrap Folder Key**:
   - Write function `wrapFolderKeyForRecipient(folderKey: CryptoKey, recipientPublicKeyPem: string): Promise<string>`.
   - Steps:
     1. Import recipient's public key as an RSA-OAEP CryptoKey.
     2. Wrap the folder's AES key with the recipient's RSA public key.
     3. Return the base64-encoded wrapped key result.
