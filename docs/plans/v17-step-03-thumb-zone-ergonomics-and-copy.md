# v17 Step 03: Thumb-Zone Ergonomics & Plain Human Truth Copy

## Objective
Satisfy **Ergonomía de Sillón** (Couch Approved) and **Lenguaje de Cancha**:
1. Bring 100% of mobile form controls and triggers above the fold without cramped scrolling.
2. Transform cold, defensive engineer copy into clear, respectful, and dignified human sovereignty.

## Implementation Details
1. **Mobile Login Viewport Optimization (`login.tsx`)**:
   - Compact the trust badges: combine the 3 stacked pills into a single horizontal scrolling or concise sovereign badge (`🔒 Cifrado de origen · Tu PIN abre todo`).
   - Remove redundant descriptive audit boxes that push the email and password inputs below the fold on mobile.
   - Ensure the primary submit button (`Open ABRN Drive`) is immediately visible in the thumb sweep on a 480x960 portrait screen without requiring scrolling.
2. **Copy Overhaul (Lenguaje de Cancha)**:
   - Eradicate audit defensiveness:
     - Replace: *"Secure Drop keeps recovery material for authorized owner recovery, so its trust model is stated separately..."*
     - With: *"Bóveda blindada. Tus archivos se cifran en tu dispositivo antes de viajar. Nadie en el servidor puede abrirlos sin tu llave."*
3. **Verification**:
   - Inspect layout on live Android 13 via `filemon-mobile screenshot`.
