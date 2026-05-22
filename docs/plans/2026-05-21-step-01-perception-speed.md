# Step 1 — Perception Speed: Make It Feel Instant

**Parent:** [Hackathon Index](./2026-05-21-hackathon-index.md)  
**Priority:** 🔴 Critical  
**Effort:** M (1 day)

---

## Why This Is Step 1

Nothing else matters if the app feels slow. A hackathon judge will form an opinion in the first 3 seconds. If there's a white flash, a layout shift, or a spinner that lasts more than 200ms, you've already lost their attention.

The current state is good — the SPA is code-split, Vite builds are fast, the Go backend responds in single-digit milliseconds. But "good" isn't "undeniable." We need to close every remaining perception gap.

---

## Current State (Verified)

- **Code splitting:** Already in place. Heavy pages (Files, Settings, Groups, etc.) use `React.lazy()`.
- **Page loader:** A simple blue spinner (`PageLoader` component). Functional but generic.
- **Dashboard:** Makes 4 parallel `fetch()` calls on mount. Stat cards show a skeleton.  Activity and Security Posture have their own loading states.
- **FOUC prevention:** Inline `<script>` in `index.html` sets `data-theme` before React mounts. ✅ Working.
- **Build:** 531 KB main chunk. Gzip 159 KB. First paint depends on this landing.

---

## Success Condition

After this step:
1. Every authenticated page shows a **branded skeleton** within 100ms of navigation.
2. The dashboard loads stat cards with **staggered fade-in** (not all-at-once pop).
3. No layout shifts on any page transition.
4. The `PageLoader` spinner matches the active theme's primary color.
5. Navigation between pages feels **instant** — no white flash, no content jump.

---

## Implementation Plan

### 1.1 — Theme-Aware Page Loader

**File:** `vaultdrive_client/src/App.tsx`

Replace the generic blue spinner with a branded one that uses CSS custom properties.

```tsx
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
```

**Why:** The current hardcoded `border-blue-500` clashes with Cyberpunk (neon yellow), Elegant (gold), and Business (corporate blue) themes. Using `border-primary` inherits the active theme automatically.

### 1.2 — Staggered Dashboard Card Animation

**File:** `vaultdrive_client/src/pages/dashboard.tsx`

When stats finish loading, the 4 stat cards should fade in with a staggered delay (50ms apart). This creates a "cascade" effect that feels alive without being slow.

```css
/* Add to skins.css or dashboard-specific styles */
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.stat-card-enter {
  animation: fadeSlideUp 0.3s ease-out both;
}
```

Apply via inline `style={{ animationDelay: \`${index * 50}ms\` }}` on each card.

### 1.3 — Prefetch Critical Routes

**File:** `vaultdrive_client/src/components/layout/Sidebar.tsx` (or wherever the nav links live)

Add `onMouseEnter` prefetch hints for the most common navigation targets. When the user hovers over "Files" in the nav, start loading the chunk before they click.

```tsx
const prefetch = (factory: () => Promise<any>) => {
  return { onMouseEnter: () => factory() };
};

// On the Files nav link:
<NavLink to="/files" {...prefetch(() => import("../pages/files"))}>
```

**Why:** This turns a 200ms chunk load into a 0ms load because the chunk is already in memory by the time the click fires. The app appears to respond before the user acts.

### 1.4 — Skeleton Consistency Audit

**Files:** All pages with loading states.

Audit every page for consistent skeleton patterns:
- Dashboard: ✅ Already has skeletons.
- Files page: Check if initial file list has a skeleton.
- Settings: Check if tabs load instantly.
- Groups: Check if the group list shows skeletons.

For any page missing a loading skeleton, add a minimal `animate-pulse` placeholder that matches the final layout shape.

### 1.5 — Eliminate Layout Shift on Auth Check

**File:** `vaultdrive_client/src/components/protected-route.tsx`

If the protected route redirects to `/login` on missing token, the brief render of the layout before redirect causes a flash. Verify this is handled — if the token is absent, return `null` (or the PageLoader) synchronously before any layout renders.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Theme-aware spinner | Spinner uses `border-primary` | Switch to each theme, trigger lazy load, observe spinner color |
| Staggered cards | Cards cascade in over ~200ms | Load dashboard, watch animation |
| Prefetch on hover | Files chunk loads before click | Open Network tab, hover "Files" nav, see chunk request fire before click |
| No layout shift | CLS = 0 on page transitions | Use Lighthouse or manual observation |
| Protected route | No flash before login redirect | Clear token, navigate to `/dashboard`, expect instant redirect |

---

## Risk

**Low.** All changes are CSS/UI polish. No backend changes. No data model changes. Every change is independently reversible.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |
