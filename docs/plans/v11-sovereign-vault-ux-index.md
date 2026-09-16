# Plan Index: v11 Sovereign Vault Top-Tier UI/UX Architecture

This document indexes all sequential, incremental steps required to elevate **ABRN Drive** from standard web cloud storage to an optical-grade, sovereign desktop-class cryptographic vault experience.

---

## Architecture Principles for v11

1. **The Physics of Speed (<16ms Frame Budget)**: Eliminate perceived latency by pairing the sub-5ms native Go backend with speculative worker pipelining and local cache priming.
2. **Physicality of the Cryptographic Vault**: Zero-knowledge encryption rendered as visible, tactile machinery—optical lens transitions instead of generic spinners, tumbler PIN feedback, and sub-pixel craftsmanship.
3. **Cryptographic Transparency as Luxury**: Mathematical certainty over blind trust—live cryptographic passports, external route HUDs, and one-tap emergency sever killswitches.
4. **Desktop-Class Flow**: Zero-mouse operations with Vim navigation (`J`/`K`), macOS-style Spacebar Quick Look, multi-item staging docks, and full transactional undo (`⌘Z`).

---

## Sequential Implementation Roadmap

1. **[Step 1: Universal Affordances, Cursor Contract & Viewport Scroll Intelligence](file:///lamp/www/ABRN-Drive/docs/plans/v11-step-01-affordances-and-scroll.md)**
   - Strict `cursor-pointer` contract across all interactive nodes (rows, cards, badges, tree items).
   - Viewport scroll reset on folder selection (`scrollTop = 0` smooth jump).
   - Return-scroll anchoring when dismissing preview or modals.
   - Sub-pixel row elevation, active press depression (`scale-[0.998]`), and magnetic hover washes.

2. **[Step 2: Desktop-Class Spatial & Keyboard Navigation (Vim, Space Quick Look, `⌘K`)](file:///lamp/www/ABRN-Drive/docs/plans/v11-step-02-keyboard-and-quicklook.md)**
   - Keyboard traversal with `J`/`K` and `↑`/`↓` with high-contrast active row focus rings.
   - macOS-style `Spacebar` instantaneous floating Quick Look toggle.
   - `Enter` to drill into folders / trigger decryption; `Backspace` / `←` to navigate to parent.
   - Unified `⌘K` omniscient command palette with operational vault commands (`/share`, `/download`, `/revoke`, `/inspect`).

3. **[Step 3: Speculative Decryption Pipelining & Optical Focus Animation](file:///lamp/www/ABRN-Drive/docs/plans/v11-step-03-speculative-decryption-and-lens.md)**
   - Speculative cipher priming: on row hover (>70ms), worker primes the AES-GCM unwrap vector and prefetches initial payload blocks.
   - "The Lens" decryption transition: 80–120ms optical focus effect where stylized mathematical entropy dissolves into rendered documents.
   - Fluid PIN tumbler: 4-digit input auto-focuses, pulses on validation, and dissolves directly into decrypted view.

4. **[Step 4: The Cryptographic HUD & Real-Time Security Passport (`⌘I`)](file:///lamp/www/ABRN-Drive/docs/plans/v11-step-04-crypto-hud-and-passport.md)**
   - Slide-out Cryptographic Passport drawer (`⌘I` / `P`): live SHA-256 golden hash, cipher tags, key versions, and tamper verification.
   - Live External Route HUD: pulsing status beacons showing active external paths (green = healthy, amber = expiring <24h).
   - One-Tap Emergency Sever / Revoke Killswitch with instant atomic feedback and audit confirmation.

5. **[Step 5: Tactile Drag-and-Drop Canvas & Executive Staging Dock](file:///lamp/www/ABRN-Drive/docs/plans/v11-step-05-drag-drop-and-staging-dock.md)**
   - Full-window illuminated drop aura indicating exact target path.
   - Hover-to-expand tree navigation during drag (expand folder after 500ms hover).
   - Multi-item Staging Dock: park selected files with `X` or drag-to-dock for batch sealing, bulk sharing, and multi-file downloads.
   - Transactional undo stack (`⌘Z`) with 10-second rollback toast.

6. **[Step 6: Audio-Tactile Haptics & Ephemeral Vault Privacy Shutter (`⌘L`)](file:///lamp/www/ABRN-Drive/docs/plans/v11-step-06-audio-haptics-and-vault-shutter.md)**
   - Low-latency Web Audio API synthesized mechanical micro-clicks (PIN tumbler, vault unlock chime, deadbolt revocation).
   - User toggle in Settings (Haptic Audio Feedback on/off).
   - Ephemeral Privacy Shutter (`⌘L` or 3-min idle): instant frosted obsidian privacy screen with memory scrubbing of decrypted ArrayBuffers.
