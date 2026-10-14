# Step 01: Universal Executive Modal Canvas Architecture
> **Part of Plan 21: Brenda's Executive Modal & Sticky Tactical Dock**

---

## 🎯 Objective
Create a reusable, highly ergonomic modal container (`ExecutiveModal.tsx`) that breaks free from traditional 500px cramped drawers and gives property presentations the widescreen presence they deserve (92vw, `maxWidth="xl"` ~1320px).

---

## 📐 Geometry & Design Specs
1. **Viewport Coverage:**
   - Desktop: `width: 92vw`, `maxWidth: '1360px'`, `maxHeight: '92vh'`.
   - Tablet / Mobile: Full viewport or `width: 98vw`, `maxHeight: '96vh'`.
   - Border Radius: `20px` continuous squircle corners.
   - Background: Pristine clean background (`#ffffff` light mode with subtle ice-slate accents `#f8fafc`).
   - Shadows: Soft multi-layered ambient elevation (`box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)`).
2. **Backdrop:**
   - Backdrop filter: `backdrop-filter: blur(8px)`.
   - Backdrop color: `rgba(15, 23, 42, 0.65)` for deep contrast focus.
3. **Internal Layout Architecture (The 3-Zone Stack):**
   ```
   ┌────────────────────────────────────────────────────────────┐
   │ 1. FROZEN TITLEBAR / HERO (Sticky top: 0, z-index: 10)     │
   ├────────────────────────────────────────────────────────────┤
   │ 2. SCROLLABLE CONTENT BODY (overflow-y: auto, flex: 1)     │
   │    - Photos, specs, amenities, financials, buyers...        │
   │    - Padding-bottom: 96px (to avoid dock collision)         │
   ├────────────────────────────────────────────────────────────┤
   │ 3. FROZEN / STICKY BOTTOM DOCK (Sticky bottom: 0, z: 10)   │
   │    - Frosted glass, buttons, navigation, totals            │
   └────────────────────────────────────────────────────────────┘
   ```

---

## 🛠️ Implementation Strategy
- File: `frontend/src/components/common/ExecutiveModal.tsx`
- Props:
  - `open: boolean`
  - `onClose: () => void`
  - `title?: React.ReactNode`
  - `children: React.ReactNode`
  - `stickyFooter?: React.ReactNode`
  - `maxWidth?: 'md' | 'lg' | 'xl' | false`
- State isolation: Clean unmount and restore scroll position on exit.

---

## ✅ Acceptance Gate
- Modal renders at 92% screen width on desktop.
- Backdrop blurs background cleanly.
- Body scrolls without pushing the top header or bottom dock off-screen.
