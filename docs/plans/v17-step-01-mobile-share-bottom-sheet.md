# v17 Step 01: 1-Tap Mobile Share Sheet & Native WhatsApp Integration

## Objective
Replace the desktop `CreateShareLinkModal` dialog on mobile devices with a high-velocity, thumb-native bottom drawer (`MobileShareSheet.tsx`). Provide instant 1-tap sharing via the native browser Web Share API (`navigator.share`) and direct WhatsApp deep linking, while automatically generating zero-knowledge `#key` links with sensible defaults (7 days expiry, auto-decrypt on arrival).

## Implementation Details
1. **Component**: Create `vaultdrive_client/src/components/mobile/MobileShareSheet.tsx`.
   - Bottom-sheet presentation with spring drawer animation and grab handle.
   - Docked to bottom 40% of viewport.
   - Trucker touch targets (≥48px height, ≥8px gap).
   - Instant generation: automatically recover key material in background when opened.
   - Primary action: Big tactile button `[ 📲 Compartir por WhatsApp ]` or `[ ⚡ Compartir (Nativo) ]`.
   - Secondary action: `[ 📋 Copiar Enlace Seguro ]` with instant haptic pulse.
   - Advanced options collapsed behind a clean toggle for power users.
2. **Integration in `files.tsx`**:
   - Detect mobile viewport or render `MobileShareSheet` when `isMobile` is active, falling back to desktop modal on wide screens.
3. **Verification**:
   - Verify sheet opens cleanly from mobile file card.
   - Test `navigator.share` fallback to clipboard copy when running in environments without native share.
