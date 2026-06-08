# Step 5 — Universal SWR Caching & Optimistic UI for All Sharing Lists

- **Title:** Universal SWR Caching & Optimistic UI for All Sharing Lists
- **Category:** Performance / Architecture
- **Why it matters now:**  
  Currently, SWR (Stale-While-Revalidate) is only used to fetch and cache the primary files list. Other critical data lists (shared folders, drop portals, file requests, agent keys) still rely on traditional `useState` + `useEffect` fetch loops. This makes the interface feel sluggish as the user clicks between pages, triggering empty screen flashes and loading spinners. Furthermore, operations like deleting or revoking a link require full roundtrips before updating the UI.
- **What exactly should be done:**  
  1. Migrate all sharing lists to use `useSWR` hooks.
  2. Implement global mutate calls for all mutations (sharing links, file requests, drop portals).
  3. Set up **Optimistic UI updates** for destructive actions (e.g. when a user clicks "Revoke link" inside `<AccessPanel>`, SWR immediately removes it from the list in <50ms while sending the REST request, falling back if the request fails).
  4. Enable SWR prefetching on hover for access control panel tabs, similar to sidebar navigation.
- **What existing work it builds on:**  
  - SWR dependency in `package.json` and the global `SWRConfig` in `main.tsx`.
  - Staggered skeleton loaders built during the enterprise polish phase.
- **What risks it avoids:**  
  - Flashing blank states when moving between screens.
  - UI lag that makes the app feel "clunky" or sluggish compared to modern SPAs.
  - Double submissions of action requests from eager clicking.
- **Expected payoff:**  
  - Zero perception latency: page transitions feel instantaneous.
  - Revoking or creating shares feels immediate and responsive.
- **Definition of Done:**  
  - [ ] 100% of REST lists (AccessPanel lists, groups, agent keys) are refactored to use `useSWR`.
  - [ ] Optimistic mutations are wired for at least: link deletion, link revocation, and group member removal.
  - [ ] Vitest setup file handles SWR cache clearing correctly so unit tests remain isolated.
  - [ ] Playwright E2E verifies list state rollbacks on simulated API request failures.
