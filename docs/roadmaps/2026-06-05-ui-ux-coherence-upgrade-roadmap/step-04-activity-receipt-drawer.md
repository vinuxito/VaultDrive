# Step 4 — Contextual Activity Receipt Drawer ("What just happened")

- **Title:** Contextual Activity Receipt Drawer ("What just happened")
- **Category:** Observability / UX
- **Why it matters now:**  
  QuantiX Drive's biggest selling point is its provable auditability and zero-knowledge model. However, currently, the audit logs live on a separate administrative/settings tab, isolated from the daily files explorer. If an AI agent reads a file or a link is accessed anonymously, the owner has no way of seeing this without digging through compliance logs. Bringing these logs to the point of action builds immediate cryptographic trust.
- **What exactly should be done:**  
  1. Build a reusable `<ActivityReceiptDrawer>` slide-over component.
  2. Add a visual indicator (such as a green pulse indicator next to file rows or a "View security receipt" option in the `<RowActionMenu>`).
  3. When clicked, it queries the backend audit log API endpoint, filters logs for the specific resource (`resource_id`), and displays:
     - Exact timestamp and IP of access.
     - The actor type (Owner, Anonymous Link, Scoped Agent Key).
     - The action performed (Read metadata, Decrypt file blob, Modify folder).
     - A clear explanation of *why* the server was unable to read the actual file payload.
- **What existing work it builds on:**  
  - Interfaces with the existing backend database audit log table and REST endpoints.
  - Composes the `TrustRail` and security timeline rendering components in `components/vault/`.
- **What risks it avoids:**  
  - Customer uncertainty about whether their zero-knowledge configuration is holding up.
  - Support burden from clients wondering "did the agent read the contents or just see the name?"
- **Expected payoff:**  
  - High observability for AI agent operations, making the agent delegation feature actually practical for enterprise users.
  - Visible verification of zero-knowledge privacy during standard operations.
- **Definition of Done:**  
  - [ ] Reusable `<ActivityReceiptDrawer>` component is created and integrated into the files grid and access list.
  - [ ] Clicking "View receipt" queries the audit logs for that file and displays correct metadata.
  - [ ] Playwright E2E verifies that uploading and downloading a file generates audit entries that appear contextually inside the drawer.
