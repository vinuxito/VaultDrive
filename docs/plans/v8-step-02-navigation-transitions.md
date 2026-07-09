# Step 2: React Router Navigation Transitions

This step wires page navigation transitions and persistent layout elements.

---

## 🎯 Goal
Configure React Router to trigger view transitions on route changes, define persistent sidebar and header elements, and animate main content panels.

---

## 🏗️ Proposed Changes

### 1. Persistent Element Mapping
#### [MODIFY] [transitions.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/styles/transitions.css)
- Add `view-transition-name: main-sidebar` on `.brand-sidebar`.
- Add `view-transition-name: main-header` on `.brand-header`.
- This tells the browser to keep the sidebar and header statically positioned during page flips, avoiding redundant transitions.

### 2. Main Body Route Transitions
#### [MODIFY] [transitions.css](file:///lamp/www/ABRN-Drive/vaultdrive_client/src/styles/transitions.css)
- Target the page content wrapper (`view-transition-name: main-body`).
- Define entry animations:
  - Slide-in from bottom-right/opacity fade for the incoming page: `::view-transition-new(main-body)`.
  - Fade-out for the outgoing page: `::view-transition-old(main-body)`.

---

## 🧪 Verification Plan
- Click sidebar links (Dashboard $\rightarrow$ My Vault $\rightarrow$ Settings) and confirm that the sidebar remains completely static while the main workspace pages transition smoothly.
