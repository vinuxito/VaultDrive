# Step 06 — Native Mobile Sovereign App (`<768px`) & Android 13 Hardware Back (`popstate`)

## Files
- `vaultdrive_client/src/components/mobile/MobileSovereignHeaderAndHub.tsx`
- `vaultdrive_client/src/components/mobile/MobileReconcileSheet.tsx`
- `vaultdrive_client/src/components/mobile/MobileReconcileSheet.test.tsx`
- `vaultdrive_client/src/components/mobile/MobileScannerSheet.tsx`
- `vaultdrive_client/src/components/mobile/bottom-nav.tsx`
- `vaultdrive_client/src/pages/files.tsx`

## Exit Criteria
- On `<768px` (`427×721` Android 13), `/abrn/files` renders the Dynamic Island `AES-256 RAM` capsule, Apple-Wallet Client Pass Carousel, **Cola de Trabajo Hoy** (`[data-testid="open-reconcile-btn"]`), **5 Subcarpetas Estándar ABRN**, and 5-slot Floating Glass Dock (`Pulso | Archivos | + ESCANEAR | Entregas | Bóveda`).
- Physical Android 13 hardware `Back` (`◀`) closes open bottom sheets cleanly via `popstate` without navigating away from `/files`.
