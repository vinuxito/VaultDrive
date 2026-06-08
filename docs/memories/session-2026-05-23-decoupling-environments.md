# Separation of QuantiX Drive and ABRN Drive

## Overview
A configuration leak caused the production instances of QuantiX Drive and ABRN Drive to cross-contaminate their themes, logos, and deployment scripts. 

- `QuantiX-Drive` repo mistakenly inherited `ABRN Drive` front-end branding via an overwritten `vaultdrive_client/.env` file.
- `ABRN-Drive` repo contained deployment scripts (`Makefile`) still pointing to the upstream `quantix-drive` binary name, `quantixdrive.service`, and `https://quantixdrive.filemonprime.net` deployment URL.

This resulted in `make deploy` inside ABRN-Drive restarting QuantiX Drive, and `make deploy` inside QuantiX-Drive building the ABRN frontend.

## The Fixes
1. **Restored Upstream Defaults**: Inside `/lamp/www/QuantiX-Drive`, the `vaultdrive_client/.env` file was replaced with `.env.example`, restoring the strict `VITE_LOGO_VARIANT="quantix"` and `VITE_PRODUCT_NAME="QuantiX Drive"` variables.
2. **Decoupled ABRN Deployments**: Inside `/lamp/www/ABRN-Drive/Makefile`, the `SERVICE` and `PROD_URL` variables were updated to point exclusively to `abrndrive.service` and `abrndrive.filemonprime.net`. The build output binary was renamed from `quantix-drive` to `abrndrive`.

## How to Prevent This in the Future
- **Do not copy `.env` files between repositories.** QuantiX Drive and ABRN Drive are physically split.
- **Vite builds bake in the `.env` configuration.** The moment `npm run build` is called, the logo variant and product name from the `.env` file are permanently baked into the static `dist/index.html` and JavaScript bundle. 
- If you're working on a feature, ensure you are in the correct repository (`/lamp/www/QuantiX-Drive` for indigo/QuantiX branding, `/lamp/www/ABRN-Drive` for burgundy/ABRN branding) so you don't inadvertently compile the wrong logo into production.
