# Step 01: Eliminate Infrastructure Noise & Fix Entry Flow

- **Title**: Eliminate Infrastructure Noise & Fix Login Destination Flow
- **Category**: `UX / product`
- **Owner**: Frontend Core / Dashboard Shell
- **Affected Files**:
  - `vaultdrive_client/src/components/layout/dashboard-layout.tsx` (lines 330–360)
  - `vaultdrive_client/src/pages/login.tsx` (line 186)
  - `vaultdrive_client/src/locales/{en,es}/common.json`

---

## 1. Why It Matters Now

Nothing erodes trust and dignity faster than software that annoys the user with technical developer artifacts and dumps them on the wrong screen:
1. **The Phantom Toast (`"Nueva actividad: connected"`)**: Every time a user opens a tab, switches between views, or unlocks their phone, the background Server-Sent Events (SSE) connection emits an operational handshake `{event_type: "connected"}`. `dashboard-layout.tsx` indiscriminately wraps this event into an `addToast("Nueva actividad: connected", "info")` notification. The user thinks an intruder or unknown event just occurred on their drive.
2. **Post-Login Abandonment on Marketing Homepage**: When an authenticated user logs in, line 186 of `login.tsx` executes:
   ```tsx
   navigate(loginIntent ?? (data.pin_set ? "/" : "/files"), { replace: true });
   ```
   If `data.pin_set` is true (all active users), the application dumps them on `/` (the public marketing landing page) rather than `/files` or `/dashboard`. The user is forced to re-orient themselves and click "Archivos" in the top bar to actually access their workspace.

Fixing these two issues costs minimal engineering time but instantly restores a calm, professional, and trustworthy user posture.

---

## 2. What Exactly Should Be Done

### A. Suppress Internal Infrastructure Pings from User Toast Feed
In `vaultdrive_client/src/components/layout/dashboard-layout.tsx`:
1. Filter out internal connection and health events (`"connected"`, `"ping"`, `"heartbeat"`, `"reconnect"`) from the notification burst queue:
   ```tsx
   const INFRASTRUCTURE_EVENTS = new Set(["connected", "ping", "heartbeat", "reconnect"]);

   // In event listener:
   if (INFRASTRUCTURE_EVENTS.has(event.event_type)) {
     // Quietly update connection state indicator; DO NOT dispatch user toast
     setIsLiveConnected(true);
     return;
   }
   ```
2. Keep user notifications strictly focused on actual business events: `"file_shared"`, `"drop_upload"`, `"link_revoked"`, `"batch_downloaded"`.

### B. Route Authenticated Logins Directly to Workspace
In `vaultdrive_client/src/pages/login.tsx` (line 186):
1. Change the default post-login destination:
   ```tsx
   // Before:
   navigate(loginIntent ?? (data.pin_set ? "/" : "/files"), { replace: true });

   // After (clean Barrio standard):
   navigate(loginIntent ?? "/files", { replace: true });
   ```
2. If `loginIntent` is present (e.g. user was trying to access `/access-center` or `/settings`), honor it; otherwise send them directly to `/files`. Never redirect an authenticated user to the public marketing page.

---

## 3. What Existing Work It Builds On
- Builds on the SSE ticketing mechanism in `main.go` and `dashboard-layout.tsx`.
- Builds on the session persistence and `loginIntent` routing in `login.tsx`.

---

## 4. What Risks It Avoids
- Avoids alarm fatigue where users dismiss real notifications because they are desensitized to repeated `"connected"` toasts.
- Avoids drop-off and confusion where first-time or returning users think login failed because they see the marketing homepage again.

---

## 5. Expected Payoff
- Immediate perceived polish: zero phantom popups on tab switches.
- 100% flow completion: logging in immediately presents the user's files and vault hero strip.

---

## 6. Definition of Done & Testable Acceptance Criteria

1. **Automated Vitest Test**:
   - `dashboard-layout.test.tsx` receives a mocked `{event_type: "connected"}` event and asserts `addToast` was **NOT** called.
   - `dashboard-layout.test.tsx` receives `{event_type: "file_shared"}` and asserts `addToast` **WAS** called with `"Archivo compartido contigo"`.
2. **Login Redirect Test**:
   - `login.test.tsx` tests successful login without `loginIntent` and asserts `navigate` was called with `"/files"`.
3. **Live Browser Verification**:
   - Log in via browser; verify instant navigation to `https://abrndrive.filemonprime.net/abrn/files`.
   - Switch tabs; verify no `"Nueva actividad: connected"` toast appears.
