# Plan Index: Multi-User ZK Shared Folders & Key Exchange

This document indexes all sequential, incremental steps required to build and verify Multi-User ZK Shared Folders and client-side key exchange.

## Steps

1. **[Step 1: Database Schema Migration](file:///lamp/www/ABRN-Drive/docs/plans/v10-step-01-db-migration.md)**
   - Add `folder_shares` table and associate with folders and users.
2. **[Step 2: Backend API Endpoints](file:///lamp/www/ABRN-Drive/docs/plans/v10-step-02-backend-api.md)**
   - Build endpoints for sharing, revoking, and listing shared folders.
3. **[Step 3: Cryptographic Key-Wrapping Helpers](file:///lamp/www/ABRN-Drive/docs/plans/v10-step-03-crypto-helpers.md)**
   - Build client helpers for fetching recipient public keys and encrypting the symmetric folder key.
4. **[Step 4: Invite & Share Modal UI](file:///lamp/www/ABRN-Drive/docs/plans/v10-step-04-share-modal-ui.md)**
   - Create share dialog with search-autocomplete to invite colleagues.
5. **[Step 5: Shared Folder Decryption (Recipient Flow)](file:///lamp/www/ABRN-Drive/docs/plans/v10-step-05-recipient-decryption.md)**
   - Wire recipient dashboard view to decrypt the folder key using their private key on load.
6. **[Step 6: Collaborative File Uploads](file:///lamp/www/ABRN-Drive/docs/plans/v10-step-06-collaborative-uploads.md)**
   - Adapt upload logic to encrypt files using the shared folder key when saving inside shared folders.
