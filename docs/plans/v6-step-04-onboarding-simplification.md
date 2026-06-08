# Step 4: Onboarding Simplification (Wall Elimination)

This step refactors the onboarding and authentication experience across both Drive platforms (QuantiX-Drive and ABRN-Drive) to comply with the **Couch Approved Philosophy** (Comfort over Complexity).

---

## 🎯 Goal
Eliminate onboarding walls. Simplify user signup and login by automating PIN generation, caching credentials seamlessly in session memory, and pre-creating initial folder structures to ensure immediate, zero-friction access.

---

## 🏗️ Friction Points & Solutions

| Existing Wall | Couch Approved Solution |
|---------------|-------------------------|
| Multi-step signup requiring manual key generation wait-times. | Background-thread key generation using Web Workers during text field typing. |
| Mandatory PIN selection and separate key setup screen. | Automate default PIN creation on registration; display it on the final onboarding card. |
| Repetitive credential prompts when sharing files or folder links. | Cache private keys securely in `sessionStorage` (encrypted via an ephemeral page-load key), auto-authorizing sharing operations. |
| Empty-state dashboard on first login. | Pre-create default core folders ("Vault Root", "External Deliveries") on user creation. |

---

## 💻 Proposed Changes

### 1. Automated Onboarding & Default Folders
#### [MODIFY] [handle_user_create.go](file:///lamp/www/QuantiX-Drive/handle_user_create.go)
- Modify user registration endpoint to automatically seed default folders:
  ```go
  // Inside user creation transaction:
  _, err = tx.ExecContext(ctx, `INSERT INTO folders (id, name, owner_id) VALUES (gen_random_uuid(), 'My Vault', $1)`, userID)
  _, err = tx.ExecContext(ctx, `INSERT INTO folders (id, name, owner_id) VALUES (gen_random_uuid(), 'External Drops', $1)`, userID)
  ```

### 2. Caching Key Credentials
#### [MODIFY] [SessionVaultContext.tsx](file:///lamp/www/QuantiX-Drive/vaultdrive_client/src/context/SessionVaultContext.tsx)
- Automatically cache derived credentials in `sessionStorage` during a successful login.
- Provide helper methods: `sessionVault.getAutoCredential()` which falls back to cached credentials to prevent PIN popup dialogs when creating public links.

### 3. Interface Refactor
- Update the login and signup cards to display a single, simplified field form.
- Render a one-click "Demo Login" button on development environments to bypass manual text input when testing from a phone.

---

## 🧪 Verification Plan
- **E2E Tests**: Playwright scripts: Register a new user, assert they are immediately logged in, confirm they have two default seeded folders in their vault list, and check that creating a public share link no longer prompts for a PIN if the credential has already been cached in this session.
