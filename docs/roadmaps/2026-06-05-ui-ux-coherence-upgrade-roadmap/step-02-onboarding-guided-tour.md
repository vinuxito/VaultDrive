# Step 2 — Interactive "First 60 Seconds" Onboarding Guided Tour

- **Title:** Interactive "First 60 Seconds" Onboarding Guided Tour
- **Category:** Product / UX
- **Why it matters now:**  
  Currently, after a new user completes the initial signup and PIN setup banner, they are dropped into an empty files explorer with no guidance on what action to take. Real-world users frequently drop off during this phase because they do not immediately understand the zero-knowledge model or how to share files. A guided walkthrough ensures they complete their first secure file loop immediately.
- **What exactly should be done:**  
  1. Build a conditional `OnboardingProgressCard` displayed on the dashboard for users who have not finished onboarding (saved in `localStorage` under `quantixdrive-onboarding`).
  2. The card shows a 3-step checklist of tasks:
     - **Task 1: Upload a test file** (triggers the file upload picker).
     - **Task 2: Generate a secure share link** (guides them to click "Share" on their uploaded file, pre-populating the modal).
     - **Task 3: Create a drop route** (guides them to the Drop portal configuration to copy an inbound link).
  3. Clicking any task triggers a glowing focal ring (using CSS shadow pulse) highlighting the relevant UI button.
  4. Dismiss the wizard with a celebration toast once all 3 tasks are marked done.
- **What existing work it builds on:**  
  - Builds on the onboarding PIN wizard in `components/onboarding/`.
  - Reuses the dynamic translation keys inside `es/drive.json` and `en/drive.json`.
  - Interfaces with existing `<CreateShareLinkModal>` and `<CreateDropLinkModal>` modals.
- **What risks it avoids:**  
  - Bounce rates right after registration.
  - User confusion regarding the benefit of browser-side encryption (the tour explains *why* the URL fragment holds the decryption key).
- **Expected payoff:**  
  - 100% of registered users reach a successful file share loop in under 60 seconds.
  - Transparent demonstration of the product's primary selling point (zero-knowledge privacy).
- **Definition of Done:**  
  - [ ] Dashboard renders the onboarding card for users with incomplete onboarding status in `localStorage`.
  - [ ] Progress ticks off in real-time as the user completes uploads, links, and drops.
  - [ ] Playwright E2E test completes the registration -> onboarding tour -> action verification loop without failures.
  - [ ] The tour can be dismissed manually and re-accessed from the Help center.
