# Step 03: 1-Click Instant Dispatch Deck ("Entrega Inmediata al Cliente")
> **Part of Plan 21: Brenda's Executive Modal & Sticky Tactical Dock**

---

## 🎯 Objective
Replicate the powerful "🚀 Entrega Inmediata al Cliente" card from Brenda's screenshot directly into the property modal. This enables an agent or broker to send the property dossier, VIP link, and PDF to an interested client in a single tap, without switching tabs or opening external apps manually.

---

## 📐 Layout & Interaction Design
1. **Container:**
   - Card with soft border (`#e2e8f0`), rounded-16px, background `#f8fafc`.
   - Header with icon: `🚀 Entrega Inmediata al Cliente` (Subtext: *Dossier oficial con fotos HD + Ficha técnica PDF + Sala VIP 48h*).

2. **Recipient Inputs (Dual Target):**
   - **Email Checkbox + Input:** `[✓] ✉️ cliente@empresa.com` (Pre-filled if a lead is selected in context).
   - **WhatsApp Checkbox + Input:** `[✓] 📱 +52 55 1234 5678`.

3. **Action Triggers:**
   - **Primary Action (Bold Blue Button with Lightning Bolt):**
     `⚡ Enviar Inmediato (1 Clic)`
     *Action:* Dispatches email and generates direct WhatsApp link with pre-composed professional pitch, tracking link, and cryptographic signature.
   - **Secondary Actions:**
     - `✏️ Personalizar Mensaje...` (Opens inline text preview).
     - `📄 Abrir PDF` (Opens the dossier directly in a new tab).
     - `🔗 Abrir VIP Link` (Simulates client view).

---

## 🛠️ Implementation Strategy
- Component: `InstantDispatchDeck.tsx` (or integrated into `UnitExecutiveModal.tsx`).
- Connected to lead discovery or quick buyer selection: If the user types or selects a prospect (e.g. Arturo), the inputs populate automatically.
- Fallback resilience: If no lead is selected, sensible placeholders invite the user to type a phone or email.

---

## ✅ Acceptance Gate
- Single-click action dispatches message preview or triggers share.
- Checkboxes toggle channels seamlessly.
- Visual styling matches Brenda's reference exactly.
