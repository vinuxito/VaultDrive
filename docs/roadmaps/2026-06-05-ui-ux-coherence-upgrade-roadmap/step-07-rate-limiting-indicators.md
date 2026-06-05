# Step 7 — Rate-Limiting UI Indicators & Client Security Hardening

- **Title:** Rate-Limiting UI Indicators & Client Security Hardening
- **Category:** Security / UX
- **Why it matters now:**  
  The backend enforces strict rate limits on critical endpoints (login: 10/min, PIN verification: 5/min). While this prevents brute-force attacks, the frontend currently handles these limits by throwing a generic error banner or a raw `429 Too Many Requests` toast. A user who accidentally mistypes their PIN multiple times is locked out without being told *why*, when they can try again, or that their vault remains safe, leading to support requests.
- **What exactly should be done:**  
  1. Update frontend request handlers to explicitly check for HTTP status `429`.
  2. Parse the `Retry-After` header returned by the backend.
  3. Render a custom locked state inside the PIN or login form showing a countdown timer (e.g. *"Too many attempts. Please wait 45 seconds before trying again."*).
  4. Temporarily disable the submission button and show a lock icon on the field.
  5. Add a clear security warning explaining that this lockout is a protection mechanism and their encrypted files are completely safe.
- **What existing work it builds on:**  
  - Rate limiting logic inside `middleware_ratelimit.go`.
  - Generic error translation mappings inside `constants/copy.ts`.
- **What risks it avoids:**  
  - Locked-out users panicking that their data is lost or their account is hacked.
  - Repeated failed login attempts causing prolonged server load.
  - Frustrated customer support tickets.
- **Expected payoff:**  
  - Clear user expectations on lockout windows.
  - Calm, guided security experience during stressful authentication errors.
- **Definition of Done:**  
  - [ ] Frontend parses HTTP `429` responses and extracts the retry lockout time.
  - [ ] Submission forms display a ticking countdown timer.
  - [ ] Submission inputs and buttons are disabled during the lockout period.
  - [ ] Playwright E2E verifies lockout UI triggers when rate-limiting limits are reached.
