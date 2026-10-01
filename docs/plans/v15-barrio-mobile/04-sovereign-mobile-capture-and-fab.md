# Step 4: Sovereign Mobile Capture & Fast Speed-Dial

## Objective
Enable instant direct-to-vault camera encryption and thumb-level actions via the floating action speed-dial, honoring the **Intent Engine** and **Ley 4: Rescate Sobre Disculpa**.

## Problem Analysis
On mobile, the primary real-world "file" created on the go is a photograph: a signed receipt, contract, ID card, or whiteboard note. Clicking "Subir Archivo" launches the generic OS file browser, forcing the user to take a photo using their native camera app (which saves an unencrypted copy in Google Photos/iCloud) and then select it.

## Architectural Changes
1. **Direct Camera Capture Input:**
   - Add a hidden file input specifically configured for camera capture:
     `<input id="camera-capture-input" type="file" accept="image/*" capture="environment" className="hidden" />`
   - When triggered, it opens the device camera directly. Once captured, the raw image stream is processed entirely in memory inside the client-side AES-256 Web Worker, encrypting it before upload.
2. **Speed-Dial Expansion in `FloatingActionButton.tsx`:**
   - 📸 **"Foto Directa a la Bóveda" (Cámara Segura):** Direct camera launch.
   - 📄 **"Subir Archivo / Documento":** General file picker.
   - 📁 **"Nueva Carpeta":** Opens folder creation bottom sheet.
   - 🔒 **"Bloquear Bóveda":** Instant 1-tap vault lockdown.
   - All speed dial buttons elevated to minimum 48×48px with clear high-contrast labels.

## Verification
- Test camera input triggering in Android 13 Waydroid.
- Verify AES-256 encryption pipeline processes captured photo seamlessly.
