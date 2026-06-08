# Operation: Until They Are Couch Approved — 24-Hour Production Launch Roadmap

Welcome to **Operation: Until They Are Couch Approved**. This roadmap defines the concrete design and execution steps to take the `QuantiX Drive`, `ABRN Drive`, and the underlying `uappgenerator` platform live on production within 24 hours under the **Couch Approved Philosophy**.

---

## 🛋️ Couch Approved Philosophy

Every feature in this deployment must be verified against these core principles:
1. **Comfort over Complexity**: No manuals, training, or tribal knowledge required. It must feel completely intuitive.
2. **Answers over Features**: Show the user immediate statuses and facts, not raw logs or complex reports.
3. **Remove Walls, Don't Explain Walls**: Eliminate unnecessary clicks, registration fields, and loading delays.
4. **Real-Life First**: Designed for tired humans using one hand on a phone on a couch with half their attention elsewhere.
5. **The Arturo Test**: If the user is left wondering *¿Y por qué no sale aquí?*, it is a bug.
6. **Invisible Excellence**: The best software works so smoothly that the user completely forgets it's there.

---

## 🗺️ Detailed Step-by-Step Plans

### 🚀 [Step 1: Staging Server Deployment & Vhost Setup](file:///lamp/www/QuantiX-Drive/docs/plans/v6-step-01-staging-deployment.md)
Deploys the verified codebase to the staging web server environment, ensuring correct permissions, secure `.env` variables, and automated service restarts.

### 🌐 [Step 2: DNS Wildcard Routing Configuration](file:///lamp/www/QuantiX-Drive/docs/plans/v6-step-02-dns-wildcard-routing.md)
Maps virtual hosts and configures DNS routing for `*.uappgenerator.filemonprime.net` to serve generated apps dynamically from the `/storage/deployments/` folder.

### 🧠 [Step 3: Gemini/LLM API Integration & Natural Language Ingestion](file:///lamp/www/QuantiX-Drive/docs/plans/v5-step-03-gemini-integration.md) (Wait, v6-step-03-gemini-integration.md)
Configures Gemini credentials in `.env` and wires the AI schema analysis route to ingest raw text or SQL DDL directly from a phone text area.

### 👤 [Step 4: Onboarding Simplification (Wall Elimination)](file:///lamp/www/QuantiX-Drive/docs/plans/v6-step-04-onboarding-simplification.md)
Simplifies signup and KDF key derivation, eliminating cryptographic delays, automates PIN/credential caching, and removes setup barriers.

### 🎨 [Step 5: Visual Feedback & Arturo Test Remediation](file:///lamp/www/QuantiX-Drive/docs/plans/v6-step-05-arturo-test-remediation.md)
Fixes status visibility bugs by implementing inline card overlays for decryption, copy success, and auto-shred countdowns to satisfy the Arturo Test.

### 🩺 [Step 6: Live Smoke Testing & Production Readiness Checklists](file:///lamp/www/QuantiX-Drive/docs/plans/v6-step-06-liveness-checklists.md)
Defines the final checklist (liveness/readiness check endpoints, SSL renewal, and Playwright verification) to go live on production in 24 hours.

---

*Let's execute with zero-friction.*
