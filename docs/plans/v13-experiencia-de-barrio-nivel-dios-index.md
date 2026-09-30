# Plan Index: v13 Experiencia de Barrio Nivel Dios — Ultra-Premium Sovereign Drive

> **Philosophy**: *"Maximum system capability converted into minimum human effort. The user should understand what to do, do it naturally, and immediately see trustworthy evidence that it worked. Keep the complexity underneath; if the human has to carry it, we haven't finished."*

This document indexes the sequential, incremental implementation roadmap to elevate **ABRN Drive** from a desktop-grade secure drive into an ultra-premium sovereign experience under the **7 Iron Laws of Experiencia de Barrio Nivel Dios**.

---

## Strategic Objectives & The 7 Quality Gates

1. **Ergonomía de Sillón y Pulgar (Law 2)**: 100% operable with one hand from the couch. Mobile Floating Action Button (FAB) in the lower 40% thumb zone, native bottom sheets replacing desktop dialogs on mobile, and trucker touch targets ($\ge 48\text{px}$).
2. **Ley Tola en Compartición (Law 1 & Law 6)**: 1-Tap Quick Share generating client-side encrypted ephemeral links copied to clipboard in $<300\text{ms}$ with instant haptic/visual receipts and WhatsApp/Slack-ready formatting.
3. **Velocidad Telepática & Transiciones Físicas (Law 1)**: 0ms perceptual latency via optimistic UI state updates for file rename/move/star operations and smooth spatial View Transitions without jarring DOM reloads.
4. **Estado Cero Mamadas (Law 3)**: Eradication of all false zeros (`0 B usados`, `0 archivos`) during cryptographic key derivation or background sync; explicit physical distinction between *Blindado*, *Cifrando*, and *Pendiente local*.
5. **Rescate Sobre Disculpa (Law 4)**: Indestructible user work. Upload drafts and folder selections persist across tab crashes and network drops; graceful chunk retry with 1-tap resume lever instead of form-wiping error 500s.
6. **Lenguaje de Cancha & Test de la Esquina (Law 5 & Law 7)**: Zero cryptic engineering jargon (`AES-256-GCM`, `PBKDF2`, `Shamir k of n`, `401 Unauthorized`) in front of the user. Every screen explains its purpose in $<3$ seconds with exactly one luminous primary action.

---

## Sequential Implementation Roadmap

1. **[Step 1: Ergonomía de Sillón — FAB Flotante, Bottom Sheets & Targets de 48px](file:///lamp/www/ABRN-Drive/docs/plans/v13-step-01-couch-ergonomics-fab-bottom-sheets.md)**
   - Introduce mobile Floating Action Dock (`+ Subir / Nueva Carpeta`) situated in the natural bottom 40% thumb sweep.
   - Implement universal mobile `BottomSheet` component replacing centered floating modals on viewports $< 768\text{px}$ with swipe-down dismissal physics.
   - Enforce minimum $48\times 48\text{px}$ interactive touch hitboxes across folder tree buttons, row actions, and navigation pills.

2. **[Step 2: Compartir en 1 Toque — Cifrado Inmediato, Recibo Háptico y Tarjeta WhatsApp](file:///lamp/www/ABRN-Drive/docs/plans/v13-step-02-zero-friction-sharing-and-whatsapp-card.md)**
   - Re-architect file and folder sharing to 1-Tap Quick Share: automatic WebWorker ephemeral key derivation, link generation, and clipboard write with 0-friction defaults.
   - Deliver instant visual receipt (green halo pulse + Web Audio haptic chime) and ready-to-paste WhatsApp/Slack formatted message.
   - Provide a secondary swipe-up drawer for advanced fine-tuning (PIN protection, expiry, view limits) without penalizing everyday quick shares.
   - Enrich Access Center entries with human-readable audit receipts (*"Visto hoy a las 2:15 PM desde Chrome móvil"*).

3. **[Step 3: Velocidad Telepática — UI Optimista y Transiciones Espaciales](file:///lamp/www/ABRN-Drive/docs/plans/v13-step-03-telepathic-speed-optimistic-ui-transitions.md)**
   - Implement client-side optimistic state transitions for file renaming, deletion, moving, and starring (0ms visual execution with background sync and graceful rollback).
   - Integrate native browser View Transitions API for fluid spatial folder expansion from the exact point of touch.
   - Refine subtle micro-haptics and audio feedback on primary interactions.

4. **[Step 4: Estado Cero Mamadas — Erradicación de Falsos Ceros y Estados Físicos Reales](file:///lamp/www/ABRN-Drive/docs/plans/v13-step-04-cero-mamadas-truth-states-and-ghost-busters.md)**
   - Banish all temporary false zeros (`0 B usados`, `0 archivos`) during vault key recovery and background calculation. Replace with explicit reassuring status: `[ Abriendo tu bóveda segura... ]`.
   - Implement tactile physical state badges across files and storage meters: *Blindado en chip* (solid emerald), *En tránsito* (pulsing aura), and *Sin señal* (amber with sync lever).

5. **[Step 5: Rescate Total — Borradores Indestructibles y Reintento de Red con 1 Toque](file:///lamp/www/ABRN-Drive/docs/plans/v13-step-05-rescate-total-offline-drafts-and-network-recovery.md)**
   - Save in-progress upload queues, drop route configurations, and form states into `IndexedDB` / `sessionStorage` to survive accidental tab refreshes and background app kills.
   - Network failure trap: when connectivity drops during upload, automatically pause chunks and display a friendly human recovery card (*"Se nos fue la señal tantito. Tus archivos siguen a salvo. [ Reintentar ya ]"*).

6. **[Step 6: Lenguaje de Cancha, Test de la Esquina y Verificación Integral](file:///lamp/www/ABRN-Drive/docs/plans/v13-step-06-lenguaje-de-cancha-and-test-de-la-esquina.md)**
   - Audit all i18n dictionaries (EN/ES) to replace engineering jargon with dignified human truth without sacrificing technical authority.
   - Apply the Test de la Esquina to Files, Access Center, and Shared Views: headline in plain language, immediate standing context, and one undeniable primary action.
   - Full verification battery: 100% Vitest pass rate, strict TypeScript clean (0 errors), production bundle build, and autonomous native Android 13 audit via `filemon-remote-mobile`.

---

## Execution Guarantees & Constraints

- **Single-Loop Construction**: Each step is strictly sequential, self-contained, and additive. The entire sequence can be built without breaking existing functionality.
- **Strict Invariant Protection**: No compromises on WebCrypto AES-256-GCM, zero-knowledge architecture, golden SHA-256 seals, or backend security invariants.
- **Verification Requirement**: Each step must compile with `tsc -b`, pass targeted Vitest suites, and maintain clean test passes across the 104 client test files.
