# Plan 21: Brenda's Executive Modal & Sticky Tactical Dock
> **The High-Impact, Full-Width Property Canvas with Frozen Bottom Action Dock**

---

## 🎯 Vision & Origin
Brenda (QA Lead & Product Manager) inspected the CRM property presentation and provided concrete UX references from high-volume transaction systems (Nanored CFDI modal). Her feedback was immediate:
1. **Full-Width Canvas (No more cramped 520px side drawers):** When evaluating or closing a multi-million peso property, the screen must breathe (90–94vw Cinemascope).
2. **Instant Visual Hierarchy & Contrast:** Folio, electric blue bold total, live status pills (`✓ Disponible`), QR code, and fast action pills.
3. **1-Click Instant Dispatch Deck ("Entrega Inmediata al Cliente"):** Direct phone/email targeting with single-touch delivery without third-party friction.
4. **BARRA FLOTANTE FIJA EN EL FONDO (The Sticky Tactical Dock):** As the user scrolls through dozens of photos, architectural blueprints, amenity specs, and payment schedules, the primary actions and return button stay permanently anchored at the bottom of the viewport.

---

## 🗺️ Sequential Step-by-Step Plan Index

1. [Step 01: Universal Executive Modal Canvas (`01-executive-modal-canvas.md`)](01-executive-modal-canvas.md)  
   *Cinemascope viewport geometry (92vw / maxWidth="xl"), backdrop blur, rounded-20px container, and internal scroll orchestration.*

2. [Step 02: High-Impact Hero Header & Status Badges (`02-impact-hero-header.md`)](02-impact-hero-header.md)  
   *Folio, bold electric blue total price, live availability badges, QR passport, and pill action buttons (`PDF`, `Email`, `WhatsApp`, `Copy Link`).*

3. [Step 03: 1-Click Instant Dispatch Deck (`03-instant-dispatch-deck.md`)](03-instant-dispatch-deck.md)  
   *The "Entrega Inmediata al Cliente" delivery deck with pre-filled buyer contact, channel selection, and single-click WhatsApp/Email dispatch.*

4. [Step 04: The Sticky Bottom Tactical Dock (`04-sticky-tactical-dock.md`)](04-sticky-tactical-dock.md)  
   *The frozen bottom bar anchored to the modal viewport: `← Regresar a Búsqueda / Inventario` on the left, live financial summary in the center, and primary closing levers on the right.*

5. [Step 05: Real Estate Unit & Property Integration (`05-unit-executive-integration.md`)](05-unit-executive-integration.md)  
   *Connecting the new Executive Modal into `Properties.tsx` and `SpatialClosingCockpit.tsx`, enabling Brenda, Ana, and agents to inspect any unit in this high-resolution theater.*

6. [Step 06: Verification & Experiencia de Barrio Closeout (`06-experiencia-barrio-verification.md`)](06-experiencia-barrio-verification.md)  
   *E2E browser validation with Playwright MCP, audit of the 7 Iron Laws of Barrio Experience, memory documentation, and HTML report.*

---

## 🛡️ Architectural Laws Applied
- **Ley Tola:** Action feedback under 300ms.
- **Ergonomía de Sillón:** The sticky dock keeps all vital actions in the lower 40% of the screen.
- **Cero Mamadas:** No false zeros or empty states. Real live prices and financial calculations.
- **Huella & Recibos:** Visible QR codes, property passports, and verifiable timestamps.
