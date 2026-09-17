# Step 1: 3-Way Zen Application Sidebar (`expanded` / `compact rail` / `zen hidden`)

## Overview
Reclaim crucial horizontal screen real estate for the vault explorer and wide data tables. Currently, the primary sidebar is fixed at 256px width (`w-64`) with an ephemeral boolean collapse to 72px that does not persist across page loads, lacks keyboard triggers, and cannot be completely hidden for high-focus work. This step establishes a tri-state layout system with persistent preferences and glassmorphic tooltips.

---

## Detailed Technical Objectives

### 1. State Machine & Persistence Contract
* **Modes**:
  ```typescript
  export type SidebarMode = "expanded" | "compact" | "hidden";
  ```
  - `expanded`: Width 256px (`w-64`). Full logo, nav text labels, badges, and user profile card.
  - `compact`: Width 68px (`w-[68px]`). Centered icons, micro-indicators, and hover floating glass tooltips.
  - `hidden`: Width 0px (`w-0 -translate-x-full`). Completely removed from layout flow; main content expands to 100% viewport width (`ml-0`).
* **Storage**:
  - Key: `abrndrive_sidebar_mode` in `localStorage`.
  - Default: `"expanded"` on screens `≥ 1280px`, `"compact"` on screens between `768px` and `1279px`.
  - Fallback validation: Invalid or corrupted strings safely resolve to `"expanded"`.

### 2. Interaction & Keyboard Accelerators
* **Keyboard Shortcut (`⌘B` / `Ctrl+B`)**:
  - Global window listener registered in `dashboard-layout.tsx`.
  - Pressing `⌘B`: If `hidden`, restores to previous mode (`compact` or `expanded`). If visible, hides to `hidden`.
  - Prevents default browser bookmarking behavior (`e.preventDefault()`).
* **Header Collapse Trigger**:
  - The hamburger button in the sticky top header (`dashboard-layout.tsx`) reflects the current state with an animated icon or state tooltip.
  - Left-click cycles: `expanded` ➔ `compact` ➔ `hidden` (or toggles `expanded` ⟷ `compact`, with `⌘B` for `hidden`).
* **Zen Edge Hotspot**:
  - When in `hidden` mode, an invisible 6px hover strip on the extreme left viewport edge reveals a subtle luminous vertical line. Clicking or hovering for 300ms smoothly slides the sidebar out as a floating temporary drawer.

### 3. Component Updates

#### `src/components/layout/sidebar.tsx`
* Receive `mode: SidebarMode` and `onModeChange: (mode: SidebarMode) => void`.
* In `compact` mode:
  - Render icon items wrapped in `@radix-ui/react-tooltip` with side `"right"`, displaying the translated route name and hotkey hint.
  - Align icons with optical centering (`justify-center`).
  - Collapse header logo to compact monogram glyph (`BrandLogo` mini mode).

#### `src/components/layout/dashboard-layout.tsx`
* Replace `const [sidebarCollapsed, setSidebarCollapsed] = useState(false)` with:
  ```typescript
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    const saved = localStorage.getItem("abrndrive_sidebar_mode");
    return (saved === "expanded" || saved === "compact" || saved === "hidden") ? saved : "expanded";
  });
  ```
* Compute main content margin dynamically:
  ```typescript
  const mainMarginClass =
    sidebarMode === "expanded"
      ? "md:ml-64"
      : sidebarMode === "compact"
        ? "md:ml-[68px]"
        : "md:ml-0";
  ```
* Ensure smooth CSS easing: `transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1)`.

---

## Verification Plan

1. **Unit Tests (`sidebar.test.tsx`, `dashboard-layout.test.tsx`)**:
   - Assert `sidebarMode` initializes from `localStorage`.
   - Assert pressing `⌘B` dispatches toggle to `hidden` and updates `localStorage`.
   - Assert Radix tooltips appear on hover in `compact` mode.
2. **Visual & Responsive Verification**:
   - Verify desktop view at 1920x1080 and 1366x768.
   - Confirm table headers and file names gain over 180px of horizontal room when switching to `compact` or `hidden`.
3. **No Regressions**:
   - Ensure mobile drawer (`md:hidden`) continues functioning identically without interference from desktop modes.
