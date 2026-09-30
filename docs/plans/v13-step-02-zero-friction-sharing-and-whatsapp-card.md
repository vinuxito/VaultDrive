# Step 2: Compartir en 1 Toque — Cifrado Inmediato, Recibo Háptico y Tarjeta WhatsApp

> **Iron Law 1 (Ley Tola)**: *"¿Qué pasó? ¿Cómo sé que jaló? ¿Qué sigue? (<300ms)"*  
> **Iron Law 6 (Huella & Recibos)**: *"Trust is never requested; it is demonstrated with receipts."*

---

## 1. Problem Statement & Current Bottlenecks

1. **High Friction in File Sharing**: When a user wants to share a file, clicking "Share" opens a desktop-style configuration modal with multiple tabs, expiration inputs, permission toggles, and a raw URL. The user must manually configure fields, click "Generate Link", wait, and then click "Copy".
2. **Cognitive Burden of Crypto**: The user is confronted with cryptographic jargon and raw keys when they just want to send a document to an accountant, client, or family member.
3. **Missing Immediate Proof of Life**: After copying, the user receives an ephemeral generic toast, leaving them unsure if the link includes the decryption key and will actually open for the recipient.

---

## 2. Proposed Architecture: 1-Tap Quick Share & The Butler Model

```
+-----------------------------------------------------------------------------------+
|                        1-TAP QUICK SHARE FLOW (< 300ms)                           |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ User taps "Compartir" (1 Tap) ]                                                |
|             │                                                                     |
|             ▼                                                                     |
|  [ WebWorker derives ephemeral AES-256 key + calls backend /v1/shares ]           |
|             │                                                                     |
|             ▼ (< 200ms)                                                           |
|  [ Full URL with decryption hash written automatically to navigator.clipboard ]   |
|             │                                                                     |
|             ▼                                                                     |
|  [ INSTANT RECEIPT CARD (Bottom Toast with Green Halo & Haptic Chime) ]           |
|     "✅ ¡Listo! Enlace protegido copiado a tu portapapeles."                      |
|     "Solo quien tenga esta liga puede descifrarlo en su navegador."               |
|     [ 📲 Compartir por WhatsApp ]      [ ⚙️ Más Opciones (PIN / Caducidad) ]       |
+-----------------------------------------------------------------------------------+
```

### Files to Create / Modify
- **[NEW] `vaultdrive_client/src/components/sharing/quick-share-receipt.tsx`**: High-contrast, tactile receipt banner with haptic pulse, copy confirmation, and 1-tap WhatsApp sharing intent (`https://api.whatsapp.com/send?text=...`).
- **[MODIFY] `vaultdrive_client/src/components/files/FileWidget.tsx`**: Add 1-tap quick share handler on the primary Share button; open advanced modal only on long-press or secondary gear tap.
- **[MODIFY] `vaultdrive_client/src/pages/access-center.tsx`**: Format audit records in plain conversational Spanish/English (*"Abierto hace 10 minutos desde Android · Descargado 1 vez"*).

---

## 3. Step-by-Step Implementation Details

### A. 1-Tap Quick Share Pipeline
1. Hook `useQuickShare`:
   - Checks if a valid active share already exists for this file ID in cache or `shareSource`.
   - If not, requests an ephemeral token from `/v1/shares`, wraps file key, and constructs the fully qualified URL: `${window.location.origin}/abrn/#/public/share/${token}#key=${base64Key}`.
   - Automatically writes the URL to `navigator.clipboard.writeText(...)`.
   - Triggers Web Audio micro-chime (positive chord) and haptic vibration (`navigator.vibrate?.([40, 60, 40])`).
2. Fallback handling:
   - If clipboard permissions are restricted by browser policy, automatically expand the `QuickShareReceipt` with an illuminated `[ Toca para Copiar ]` 48px button.

### B. WhatsApp / Direct Messenger Intent
- Construct clean, professional message template:
  ```text
  Te comparto este documento seguro vía ABRN Drive:
  [Nombre del archivo] (Tamaño)
  🔒 Cifrado de extremo a extremo:
  https://abrndrive.filemonprime.net/abrn/#/public/share/...#key=...
  ```
- Action button uses `window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(message))` or native Web Share API (`navigator.share(...)` when supported).

### C. Advanced Options Bottom Sheet
- For power users needing custom expiration (e.g., 24 hours, 7 days) or custom PIN protection, provide a non-intrusive link: `[ ⚙️ Más opciones de seguridad ]`.
- Opens a clean mobile bottom sheet with simple presets (24 hrs, 3 días, 30 días, Sin caducidad) rather than manual date-picker inputs.

---

## 4. Verification & Quality Gate (Law 1 & 6 Proof)

### Automated Tests
1. **Unit Test (`quick-share.test.ts`)**:
   - Verify 1-tap flow creates share link, puts it in clipboard, and emits the expected WhatsApp message payload.
2. **Access Center Audit Test**:
   - Verify access log timestamps format as conversational text rather than raw ISO timestamps.

### Cold Verification Execution
- `npm test`
- `npm run typecheck`
- `npm run build`
