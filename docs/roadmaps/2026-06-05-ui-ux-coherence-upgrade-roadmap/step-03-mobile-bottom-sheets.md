# Step 3 — Mobile Viewport Optimization & Bottom Sheets

- **Title:** Mobile Viewport Optimization & Bottom Sheets
- **Category:** UX / Observability
- **Why it matters now:**  
  While the mobile layout has safe-area inset support and 44px touch targets, the action menus (derived from Radix UI dropdown-menu popovers) are designed for desktop hover/click placement. On small viewports (<640px), these popovers frequently overflow the screen boundary, align awkwardly, or require precise taps that cause accidental clicks on neighboring items. Native mobile applications use bottom sheet drawers for row actions; this web app must match that standard.
- **What exactly should be done:**  
  1. Adapt `<RowActionMenu>` to detect viewport width. If the viewport is under 640px, intercept the menu trigger and render the actions using a custom Vaul-based `<Drawer>` (bottom sheet drawer sliding up from the bottom of the viewport).
  2. Implement swipe-to-dismiss behavior for the mobile drawer.
  3. Relocate actions from desktop-only locations (like hover states) to explicit menu button clicks for touch-only devices.
  4. Expand the bottom-nav bar to provide easier tab switches on notched mobile devices.
- **What existing work it builds on:**  
  - Composes the `<RowActionMenu>` primitive in `components/ui/row-action-menu.tsx`.
  - Integrates with the custom touch-target CSS properties inside `index.css`.
- **What risks it avoids:**  
  - Modals overflow clipping.
  - Frustrating tap misses on destructive options (e.g. revoking a link by accident).
  - Bad visual presentation when evaluated by mobile smoke/Lighthouse audits.
- **Expected payoff:**  
  - Native-app look and feel on iOS and Android browsers.
  - 100% of row actions are easily accessible on small screens.
- **Definition of Done:**  
  - [ ] Action menus on screen widths < 640px render as bottom sheet drawers, not dropdown popovers.
  - [ ] Drawer can be closed by dragging down or tapping the backdrop.
  - [ ] No action item has a touch target height of less than 44px.
  - [ ] Playwright E2E configuration is updated to run standard flows using an emulated Pixel 5 / iPhone 13 viewport successfully.
