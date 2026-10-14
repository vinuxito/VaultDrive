# Step 05: Real Estate Unit & Property Integration
> **Part of Plan 21: Brenda's Executive Modal & Sticky Tactical Dock**

---

## 🎯 Objective
Wire the new Full-Width Executive Modal (`UnitExecutiveModal.tsx`) with its Hero Header, Dispatch Deck, and Sticky Tactical Dock into the core screens of the CRM:
1. `Properties.tsx` (Properties catalog and unit grid).
2. `SpatialClosingCockpit.tsx` (Cockpit 360° and architectural elevation view).

---

## 📐 Integration Points
1. **Properties Catalog (`Properties.tsx`):**
   - Provide a toggle or direct upgrade from the 520px side drawer to the new Executive Modal.
   - When a unit card or table row is clicked, Brenda and the sales team get the wide, cinema-grade experience by default, with option to switch or full replacement.

2. **Spatial Closing Cockpit (`SpatialClosingCockpit.tsx`):**
   - Add a high-visibility button in the tower unit inspector: `[ 🏢 Abrir Ficha Ejecutiva (Modal Completo) ]`.
   - Also allow opening directly from the active unit badge.

3. **Rich Body Content Inside the Modal:**
   - Tabs or clean sections:
     - 📸 **Galería & Planos:** High-res photos and blueprints.
     - 📊 **Datos de Certificación & Ficha Técnica:** Table identical to Brenda's screenshot (Superficie, Niveles, Mantenimiento, Orientación, QR).
     - 💰 **Simulador Financiero & Amortización:** Enganche, tasa, mensualidad.
     - 📜 **Trazabilidad y Línea de Vida:** Accordion collapsible section (`Mostrar Detalle ▾`), exactly like Brenda's second screenshot.

---

## 🛠️ Implementation Strategy
- Build `frontend/src/components/property/UnitExecutiveModal.tsx`.
- Connect into `frontend/src/pages/Properties.tsx` and `frontend/src/pages/SpatialClosingCockpit.tsx`.
- Maintain complete backward compatibility with existing tests and route splitting.

---

## ✅ Acceptance Gate
- Unit can be opened from both `Properties.tsx` and `SpatialClosingCockpit.tsx`.
- All unit data, photos, QR code, and financial numbers render accurately.
- No memory leaks or unhandled re-renders.
