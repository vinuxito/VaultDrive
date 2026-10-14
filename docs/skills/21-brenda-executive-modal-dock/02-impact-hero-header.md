# Step 02: High-Impact Hero Header & Status Badges
> **Part of Plan 21: Brenda's Executive Modal & Sticky Tactical Dock**

---

## 🎯 Objective
Implement the top hero header inspired directly by Brenda's screenshot (Nanored CFDI modal), delivering immediate visual contrast, folio identification, electric blue pricing, active status badge, and pill action buttons.

---

## 🎨 Visual Composition
Following the reference:
1. **Upper Banner:**
   - **Folio / Unit Code:** e.g., `UNIDAD: DEMO-201` (bold, crisp typography).
   - **Total / Price:** `$ 28,000,000.00 MXN` (styled in vibrant bold blue `#1976d2` or `#0284c7`, font-size 22-26px).
   - **Status Badge:** `✓ Disponible` (pill with soft green background `#ecfdf5`, green text `#059669`, border `#a7f3d0`).
   - **Financial/Operation State:** `Cap Rate: 9.2% · Venta Directa`.
   - **Quick Action Pills (Top Right):**
     - `[ 📄 PDF ]` (Ficha Técnica en 1 clic)
     - `[ ✉️ Email ]` (Preparar envío)
     - `[ 🔗 VIP ]` (Copiar Sala VIP)
     - `[ ⚡ WhatsApp ]` (Compartir por chat)
     - `[ ✕ Cerrar ]` (Cierre rápido)

2. **Secondary Identity Bar:**
   - **Identificador Único (UUID/Folio):** `unit_58969ac680297...` with an instant `[ 📋 Copiar ]` button.
   - **Verificación:** `🟢 Inmueble Certificado ante Plataforma Quantix`.
   - **Superficie & Distribución:** `320 m² · 5 Recámaras · 4 Estac.`.

---

## 🛠️ Implementation Strategy
- Component: `UnitExecutiveHeader.tsx` inside `frontend/src/components/property/` or directly inside `UnitExecutiveModal.tsx`.
- Immediate feedback: Copy UUID provides a 2-second tooltip `¡Copiado al portapapeles!`.
- No cognitive friction: Status is clearly readable from 3 meters away.

---

## ✅ Acceptance Gate
- Title and folio clearly visible.
- Price rendered in high-contrast blue with zero false zeros.
- Quick action pills respond to clicks instantly.
