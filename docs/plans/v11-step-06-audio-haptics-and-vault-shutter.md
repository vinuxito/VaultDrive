# Step 6: Audio-Tactile Haptics & Ephemeral Vault Privacy Shutter (`⌘L`)

## Overview
This final step adds the pinnacle of executive luxury and operational discretion: synthesized low-latency audio micro-haptics that give mechanical satisfaction to cryptographic operations, and an instantaneous privacy shutter (`⌘L`) that shreds plaintext buffers from browser memory when stepped away.

---

## Detailed Objectives

### 1. Synthesized Audio Micro-Haptics (Web Audio API)
* Zero external audio assets: Use native Web Audio API oscillators to generate ultra-short, velvety, executive-grade sound micro-pulses (<20ms duration):
  - **The Tumbler Click**: A subtle, warm wooden micro-tick as each PIN digit is pressed.
  - **The Vault Unlock Chime**: A deep, harmonic sub-bass swell and crystal chime when a file's ciphertext unwrap succeeds.
  - **The Deadbolt Thud**: A definitive mechanical thud when revoking a link or deleting an access key.
* **Control & Politeness**:
  - Disabled by default or enabled with a sleek toggle in Settings (`Preferences > Haptic Sound Design`).
  - Strict volume governance (-18dB to -24dB), unobtrusive, designed to satisfy the user without disturbing surroundings.

### 2. Ephemeral Vault Privacy Shutter (`⌘L` & Inactivity Lock)
* **Threat Model**: Shoulder-surfing or stepping away from an unlocked terminal in executive suites or shared offices.
* **Implementation**:
  - Hotkey `⌘L` (Lock) or 3 minutes of zero mouse/keyboard activity:
    - Screen instantly frosts with a deep obsidian privacy shutter and an elegant glowing ABRN emblem: *"Vault Locked for Privacy"*.
    - All decrypted blobs (`Blob`, `ObjectURL`, `ArrayBuffer`, cached file keys) are actively purged and zeroed from memory.
    - Decrypted text or preview canvases are unmounted instantly.
  - Quick Resume:
    - Entering the 4-digit PIN (or tapping Touch ID / biometric hardware key) unfrosts the screen with a smooth radial dissolve, restoring the active view in milliseconds.

### 3. Verifiable Executive Transfer Slips
* When downloading or exporting sensitive files:
  - Provide a 1-click option: **"Download with Cryptographic Transfer Slip"**.
  - Client-side generates a PDF receipt containing:
    - Document name, size, and Golden SHA-256 seal.
    - User ID and active session certificate fingerprint.
    - Exact ISO 8601 UTC timestamp and verification QR code.
    - Official legal non-repudiation statement.

---

## Verification Plan
1. **Audio Latency Benchmark**: Verify sound synthesis plays in <5ms from user action without blocking the main rendering thread.
2. **Memory Shredding Proof**: Trigger `⌘L`, verify through heap snapshot / DevTools that raw decrypted ArrayBuffers are freed and GC-eligible.
3. **Lock / Unlock Lifecycle**: Press `⌘L`, verify frosted screen blocks all file visibility; enter PIN, verify instantaneous return to exact scroll and selection state.
