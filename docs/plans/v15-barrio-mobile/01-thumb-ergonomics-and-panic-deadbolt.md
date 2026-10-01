# Step 1: Ergonomía de Pulgar & Panic Deadbolt in Bottom 40%

## Objective
Relocate the Sovereign Emergency Vault Lock from the top-right desktop header to the natural sweep of the thumb in the bottom 40% zone of mobile devices, adhering to **Ley 2: Ergonomía de Sillón y Pulgar Sucio**.

## Problem Analysis
Currently, `files.tsx` places the "Bloquear Bóveda" button in the top header. On a 6.7" smartphone held with one hand, a user attempting to lock their vault in an emergency (e.g. someone walking by) must either awkwardly shift their grip or use their second hand. 

## Architectural Changes
1. **Mobile Bottom Navigation (`BottomNav.tsx`):**
   - Add a high-visibility, thumb-accessible **"Bloquear" (Lock)** action button in the bottom bar between `/files` and `/shared` (or as a prominent center lock shield).
   - On tap:
     - Dispatches a custom window event `"vault-lock"`.
     - Triggers tactile audio haptics (`playDeadboltThud()`) and device vibration (`navigator.vibrate(25)`).
     - Instantly sets `isVaultLocked = true` and invokes `sessionVault.clearVault()` to scrub memory buffers.
2. **Speed Dial FAB (`FloatingActionButton.tsx`):**
   - Include a red/amber **"Bloquear Bóveda"** action in the floating action dial for instant 1-tap lock without reaching for any header.
3. **Files Page Header (`files.tsx`):**
   - Retain the desktop `⌘L` button for `md:` viewports, but make the bottom navigation the primary ergonomic driver on mobile.

## Verification
- Test in `chrome-devtools-mcp` with mobile viewport (390×844) and on native Android 13 via `filemon-mobile`.
- Verify memory scrubbing and that privacy shutter activates with 0ms delay.
