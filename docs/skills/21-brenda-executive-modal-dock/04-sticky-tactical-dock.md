# Step 04: The Sticky Bottom Tactical Dock ("Barra Flotante Fija en el Fondo")
> **Part of Plan 21: Brenda's Executive Modal & Sticky Tactical Dock**

---

## 🎯 Objective
Build the cornerstone requested by Brenda: **La Barra Flotante Fija en el Fondo** (`StickyActionDock.tsx`). As the user scrolls through property details, galleries, amenities, maps, and financial amortization tables, the bottom action bar stays permanently frozen in the lower viewport.

---

## 📐 Ergonomic & Visual Design
1. **Positioning & Blur (Frosted Glass Elevation):**
   - CSS: `position: sticky; bottom: 0; z-index: 20;`
   - Background: `rgba(255, 255, 255, 0.92)` with `backdrop-filter: blur(12px)`.
   - Top border: `1px solid rgba(226, 232, 240, 0.8)`.
   - Box shadow: `0 -10px 25px -5px rgba(0, 0, 0, 0.08)`.
   - Padding: `12px 24px`.
   - Border radius of dock: `0 0 20px 20px` (flushes with modal container).

2. **The 3-Zone Ergonomic Split:**
   - **Left Zone (Safe Return & Context):**
     - Button: `← Regresar a Búsqueda` (Clean pill button with dark text, subtle border, identical to Brenda's screenshot).
     - Status Indicator: `🟢 Unidad Disponible · DEMO-201`.
   - **Center Zone (Financial Live Telemetry):**
     - Live readout: `Precio: $28,000,000 MXN · Enganche (20%): $5.6M · Mensualidad: $142,500 MXN`.
     - Matching Lead: `Arturo · Match: 98%`.
   - **Right Zone (Primary Tactical Closing Levers):**
     - Button 1 (Secondary): `📄 Ficha PDF` (Dossier con sellos).
     - Button 2 (Secondary): `🔗 Copiar VIP Link`.
     - Button 3 (Primary Hero): `⚡ Despachar por WhatsApp` (Vibrant green/blue, min-height 48px).

---

## 🛠️ Implementation Strategy
- Component: `StickyActionDock.tsx`
- Fully responsive:
  - Desktop: 3 zones fully laid out horizontally.
  - Mobile / Small viewports: Stacks gracefully into 2 rows, keeping the return button and the primary WhatsApp action accessible with one thumb.

---

## ✅ Acceptance Gate
- Dock remains completely visible and fixed when the modal content scrolls.
- Clicking `← Regresar a Búsqueda` closes the modal immediately.
- Action buttons trigger their respective handlers without jitter or layout shifts.
