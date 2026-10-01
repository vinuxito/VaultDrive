# Step 3: Sovereign Mobile PIN Dialer (Tactile Numeric Keypad)

## Objective
Replace disruptive desktop text dialogs with a native-style **4x3 Numeric Keypad (Dialpad)** for all PIN entry interactions on mobile viewports, adhering to **Ley 2 (Ergonomía de Sillón)** and **Ley 1 (Ley Tola)**.

## Problem Analysis
Currently, when a PIN is required (in `VaultPrivacyShutter.tsx` or during file download/decryption in `files.tsx`), a centered floating modal pops up. When the user taps the input, the OS software keyboard pops up, jumping the layout and hiding action buttons.

## Architectural Changes
1. **Component `SovereignPinPad.tsx`:**
   - Dedicated 4x3 keypad layout:
     ```
     [ 1 ] [ 2 ] [ 3 ]
     [ 4 ] [ 5 ] [ 6 ]
     [ 7 ] [ 8 ] [ 9 ]
     [ C ] [ 0 ] [ ⌫ ]
     ```
   - Digit indicator HUD: 4 glowing circular markers (`○ ○ ○ ○` filling with accent light as digits are pressed: `● ● ○ ○`).
   - Tactile feedback: Audio click (`playTumblerClick()`) and haptic pulse (`navigator.vibrate(15)`) on every key press.
   - Auto-Unlock: Upon the 4th digit entered, automatically fires `onSubmit(pin)` within 50ms, playing `playUnlockChime()`.
   - Error Shake: If an invalid PIN is entered, the 4 dots shake with red accent and clear automatically after 400ms.
2. **Integration:**
   - Embed into `VaultPrivacyShutter.tsx` on mobile viewports (`sm:hidden`).
   - Embed into download PIN confirmation bottom sheet.

## Verification
- Test PIN entry in Android 13 without invoking the system keyboard.
- Verify haptic and audio synchronization.
