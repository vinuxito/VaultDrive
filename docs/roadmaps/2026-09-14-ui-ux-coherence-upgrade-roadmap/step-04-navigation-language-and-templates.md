# Step 04 — Unify navigation, language and interaction across templates

[Roadmap index](index.md) · Priority 4 · Status: proposed · Complexity: M

**Category:** UX / product

## Why it matters now

The six-template repair improved readability, but coherent use also requires stable navigation and interaction. Fresh B01–B04 show mixed EN/ES journeys, a non-dismissing ESC palette, two headers on Access Center, and missing Access Center/Help destinations in phone navigation. These are concrete orientation defects, not a reason to replace a template.

[ProtectedRoute](../../../vaultdrive_client/src/components/protected-route.tsx) already supplies DashboardLayout. Several pages also wrap themselves, including [Access Center](../../../vaultdrive_client/src/pages/access-center.tsx#L132), [Help](../../../vaultdrive_client/src/pages/help/index.tsx#L25), Profile and Admin Tests. Audit each route's actual shell before removing a wrapper.

## What exactly should be done

1. Establish one owner of the authenticated shell. Remove duplicate layout composition where confirmed. Preserve the public recipient/sender framing and real admin authorization; a public link should not look like it requires an owner account.
2. Make sidebar, phone drawer, bottom navigation and command palette use consistent route names, role visibility and active-route rules. Keep bottom navigation selective, but make every authorized primary destination available from the phone drawer. Nested group routes must retain a meaningful parent/breadcrumb.
3. Define the task vocabulary in EN/ES, using existing locale files and shared copy: Files, Shared with me, access sent through links, receive files, File Requests, security/settings/help. Explain distinct concepts rather than merging them into an ambiguous “Share.” Translate critical landing/login/recovery/transfer/status copy, accessible names and command actions.
4. Fix palette Escape handling, focus containment/return and accessible naming using existing primitives. Closed drawers must be absent from keyboard/accessibility traversal; inspect [ActivityFeedPanel](../../../vaultdrive_client/src/components/layout/ActivityFeedPanel.tsx#L26), which remains mounted offscreen. Add an unknown-route recovery page and named route loading state.
5. Preserve each template's selected palette/layout and selection persistence. Audit open phone menus, drawers, errors, focus rings, destructive confirmations and long translated labels across `light`, `business`, `dark`, `quantix`, `cyberpunk`, `elegant`. Make fixes through existing semantic tokens/components. Inspect overlays after animation settles; background content must not interfere with reading or tapping foreground controls.
6. Reuse the existing sign-out/session-clearing behavior across menu entry points, so navigation cannot leave inconsistent authenticated/key-cache state. Keep this bounded to existing logout semantics and regression tests.

## What existing work it builds on

- [Routes](../../../vaultdrive_client/src/App.tsx#L45), [sidebar](../../../vaultdrive_client/src/components/layout/sidebar.tsx), [phone drawer](../../../vaultdrive_client/src/components/layout/mobile-nav.tsx#L63), [bottom navigation](../../../vaultdrive_client/src/components/mobile/bottom-nav.tsx), [command palette](../../../vaultdrive_client/src/components/ui/command-palette.tsx).
- Existing language toggle, `constants/copy.ts`, RowActionMenu and [June mobile closeout](../../memories/session-2026-06-06-mobile-bottom-sheets-closeout.md).
- [Theme visibility tests](../../../vaultdrive_client/e2e/theme-visibility.spec.ts) and [September visual evidence](../../reports/2026-09-14-theme-contrast-verification.md). Extend their interaction coverage instead of treating a prior route screenshot as proof of every menu state.

## What risks it avoids

Users getting lost, inaccessible hidden controls, desktop-only access management, accidental template drift and inconsistent logout. Developer-centric renaming must not conceal real product distinctions.

## Expected payoff

The same task is recognizable in every navigation surface and language; users can reach it and recover from a wrong turn on a phone.

## Definition of done

- [ ] All 21 current route patterns have a documented shell/role; authenticated pages render exactly one application header/sidebar instance, with no nested shell offset. Public routes retain their own framing.
- [ ] Owner can reach Access Center and Help from phone navigation without typing a URL. Nested Groups retains active context; browser Back and unknown-route recovery work.
- [ ] For the audited journeys, EN and ES have no unintended fallback English, raw translation keys or untranslated accessible names. User-entered filenames and brand names remain unchanged.
- [ ] Command palette closes with Escape, restores focus and contains keyboard interaction while open. Closed panels are not focusable/exposed as active dialogs. Logout entry points clear the same authorized session/key state.
- [ ] At 390px and desktop widths, every actionable open/error/confirmation state remains visible, scrollable and usable under all six templates; long labels and 200% zoom preserve primary actions. Existing contrast checks pass, and excluded/translucent states receive visual review.
- [ ] No new template, palette replacement, global state dependency or unrelated explorer rewrite is introduced.

## Builder boundaries and handoff

Own shell/navigation/locale consistency. Step 01 owns access actions, Step 02 transfer logic, and Step 03 state semantics. Extract shared route metadata only where it removes existing duplication; avoid turning this pass into a routing framework redesign.
