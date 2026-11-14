# Step 04 — Live `⚡ Dual en Vivo` Continuum Dock, `Estudio Móvil`, & `#sacred-receipt-banner`

## Files
- `vaultdrive_client/src/components/vault/ContinuumDockPane.tsx`
- `vaultdrive_client/src/pages/files.tsx`

## Exit Criteria
- Same-origin `fetch("${BASE_PATH}/previews/mobile.html")` + `iframe.srcdoc` + `window.__ABRN_BOOT` embeds the live synchronized mobile companion cleanly under `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
- `⚡ Escanear Cel → PC` (`data-testid="btn-magic-cross"`) animates the mobile scanner, encrypts & uploads a real `AES-256-GCM` PDF into the active folder, and illuminates `#sacred-receipt-banner` with the real SHA-256 seal.
