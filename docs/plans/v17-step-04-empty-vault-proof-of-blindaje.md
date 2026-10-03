# v17 Step 04: First-Run Interactive Proof of Blindaje

## Objective
Conquer the **Test de la Esquina** ("¿Y esta mamada qué? ¿Para qué sirve o qué le pico?"):
Transform the empty vault screen from a silent, technical table into an undeniable, interactive 1-tap demonstration of sovereign encryption.

## Implementation Details
1. **Component**: Create `vaultdrive_client/src/components/vault/VaultProofOfBlindajeCard.tsx`.
   - Clear value proposition:
     > *"¿Por qué esta bóveda es diferente? Aquí nada viaja en claro."*
   - Interactive 1-tap trigger:
     - `[ ⚡ Probar Blindaje en Vivo (1 seg) ]`
   - Real-time WebCrypto action:
     - Generates a sample payload (`"Documento Confidencial #001 · Blindado por ABRN"`).
     - Derives key and encrypts via `crypto.subtle.encrypt(AES-GCM)`.
     - Displays raw ciphertext scramble before and after:
       `Texto original: "Contrato Confidencial.pdf"`
       `Cifrado en chip: 7f 3a c9 b2 41 80 de... [Ilegible para el servidor]`
     - Stamped with green checkmark: *"Listo: así viaja todo archivo que pongas aquí."*
   - Direct Call to Action:
     - `[ 📁 Subir mi primer archivo blindado ]` (triggers file picker).
2. **Integration**:
   - Render inside `files.tsx` when `files.length === 0 && !loading && !searchQuery`.
3. **Verification**:
   - Verify 1-tap encryption demo runs entirely in browser memory with zero network calls and triggers file picker on action.
