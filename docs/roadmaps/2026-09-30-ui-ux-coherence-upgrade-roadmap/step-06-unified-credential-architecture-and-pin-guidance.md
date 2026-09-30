# Step 06: Unified Credential Architecture & PIN Guidance

- **Title**: Unified Credential Architecture & Contextual PIN Guidance
- **Category**: `security / UX`
- **Owner**: Frontend Core / Security UX
- **Affected Files**:
  - `vaultdrive_client/src/components/vault/PasswordModal.tsx`
  - `vaultdrive_client/src/components/vault/VaultPrivacyShutter.tsx`
  - `vaultdrive_client/src/pages/settings.tsx`
  - `vaultdrive_client/src/locales/es/drive.json`
  - `vaultdrive_client/src/locales/en/drive.json`

---

## 1. Why It Matters Now

ABRN Drive's cryptographic model is exceptionally strong, but it relies on **three distinct security tiers**:
1. **Contraseña de Cuenta (Account Password)**: Authenticates the user with the Go backend API.
2. **PIN Soberano de Sesión (4-Digit Sovereign PIN)**: Unwraps the browser-held RSA private key and session vault without exposing the master password.
3. **Llaves de Enlace (File / Share Keys)**: Symmetric 256-bit AES keys embedded in URL hash fragments (`#...`).

Currently, when the Privacy Shutter triggers (after 3 minutes of inactivity) or when a file requires decryption, the prompt ambiguously asks: *"Ingresa tu credencial"*.

Users routinely type their complex 14-character account password into a 4-digit PIN tumbler, or their 4-digit PIN into a password input field. When key derivation fails, the application displays: *"No se pudo descifrar el archivo"*. The user panics, assumes their file is corrupted, and submits an account recovery request.

---

## 2. What Exactly Should Be Done

### A. Visually Distinct Credential Modes with Instant Escape Hatches
In `vaultdrive_client/src/components/vault/PasswordModal.tsx`:
1. Provide unmistakable visual differentiation between PIN and Password modes:
   - **PIN Mode**: 4 circular dot indicators with automatic tumbler focus, numpad support, and procedural haptics. Title: *"PIN de Bóveda (4 dígitos)"*. Subtitle: *"El PIN que configuraste para desbloquear tus llaves rápidamente."*
   - **Password Mode**: Standard secure text box with reveal eye. Title: *"Contraseña de Cuenta ABRN"*. Subtitle: *"La contraseña con la que inicias sesión en ABRN Drive."*
2. Provide a 1-tap escape switch:
   > *"¿No recuerdas tu PIN? [Usar tu contraseña completa]"*
   Allowing users to switch modes without closing the dialog or aborting their current download/preview.

### B. Humanize Privacy Shutter Unlock Experience
In `vaultdrive_client/src/components/vault/VaultPrivacyShutter.tsx`:
1. Replace intimidating cryptographic warnings with reassuring human copy:
   - **Before**: *"Bóveda Bloqueada por Privacidad. Todos los búferes de memoria descifrados fueron purgados. Ingrese su PIN de sesión soberano."*
   - **After (Lenguaje de Cancha)**: *"Bóveda protegida por seguridad. Tu pantalla descansó para cuidar tus archivos. Pon tu PIN de 4 dígitos y te dejamos justo donde estabas."*
2. Provide an emergency reset button: *"¿Olvidaste tu PIN? Cerrar sesión para entrar con tu contraseña"*.

### C. "Tus Llaves y Seguridad" Summary in Settings
In `pages/settings.tsx`:
- Add a high-visibility security status card:
  - **PIN Soberano**: `[ ●●●● Activo ]` · *Permite descifrar archivos en 1 segundo.*
  - **Contraseña de Cuenta**: `[ Protegida ]` · *Último cambio hace 3 meses.*
  - **Llaves de Recuperación**: `[ 3 de 5 Custodios Listos ]` · *Protección contra extravío.*

---

## 3. What Existing Work It Builds On
- Builds on `PasswordModal.tsx`, `audioHaptics.ts`, and `VaultPrivacyShutter.tsx`.
- Builds on `SessionVaultContext.tsx` and PBKDF2/PIN unwrap handlers in `crypto.ts`.

---

## 4. What Risks It Avoids
- Avoids failed decryption lockouts caused by simple credential mismatch.
- Avoids unnecessary account resets that disrupt client productivity.

---

## 5. Expected Payoff
- Zero user confusion between PIN and password.
- Instant, effortless recovery from privacy shutter auto-locks.

---

## 6. Definition of Done & Testable Acceptance Criteria

1. **Automated Unit Tests**:
   - `PasswordModal.test.tsx` tests toggling between PIN and Password modes; asserts input attributes change between `maxLength=4` and full password string.
   - Tests unwrap failure messaging; asserts it instructs the user to check whether they typed their PIN or password.
2. **Strict TypeScript & Build**:
   - `npm run typecheck`: 0 errors.
   - `npm run build`: 0 errors.
3. **Live Browser Verification**:
   - Trigger Privacy Shutter via `⌘L`; verify the unlock card displays clean Mexican Spanish copy and accepts the 4-digit PIN with procedural audio feedback.
