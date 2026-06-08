# Step 2 — Landing Page: The 5-Second Wow

**Parent:** [Hackathon Index](./2026-05-22-hackathon-index.md)  
**Priority:** 🔴 Critical  
**Effort:** M (1 day)  
**Status:** ✅ **DONE** — Shipped `aff37ae`, verified 2026-05-21

---

## Why This Matters

The landing page (`/quantix/` → `home.tsx`) is the first thing a judge sees. It had been functional and clean — branded logo, feature cards, tech stack section, footer. But it read like a README rendered as HTML.

For a hackathon, the landing page needs to make the judge think: *"Wait, this was built in a hackathon?"* It needs to feel like a $50M product launch page, not a student project.

---

## What Was Implemented

### 2.1 — Animated Hero Background ✅

**File:** `vaultdrive_client/src/pages/home.tsx`  
**CSS:** `vaultdrive_client/src/styles/elegant-complete.css`

Added a slowly shifting gradient background to the hero section using CSS custom properties. The gradient uses the active theme's colors so it looks premium on every skin.

```css
@keyframes heroGradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.hero-animated-bg {
  background: linear-gradient(
    -45deg,
    hsl(var(--background)),
    hsl(var(--primary) / 0.15),
    hsl(var(--secondary) / 0.10),
    hsl(var(--background))
  );
  background-size: 400% 400%;
  animation: heroGradientShift 15s ease infinite;
}
```

**Why it matters:** A static hero says "template." A breathing gradient says "alive." The slow 15-second cycle is perceptible but not distracting — it creates the subliminal feeling that the app is *present*.

### 2.2 — Complete Hero Copy Rewrite ✅

**File:** `vaultdrive_client/src/pages/home.tsx`

Replaced generic SaaS boilerplate with specific, confident, verifiable language:

**Before:**
> Enterprise-grade secure cloud storage with zero-knowledge encryption. Built with cutting-edge technology for maximum privacy and security.

**After:**
> Your files are encrypted in your browser before they ever touch our server. We can't read them. Nobody can. Store, share, and collaborate — backed by provable, auditable cryptography.

**Why it matters:** Every SaaS product says "enterprise-grade." Nobody says "we can't read your data." The specificity *is* the differentiator.

### 2.3 — Cycling Encryption Trust Signal ✅

**File:** `vaultdrive_client/src/pages/home.tsx`

Added a monospace badge near the hero that cycles through 4 cryptographic claims every 2.5 seconds:

```
→ AES-256-GCM client-side encryption
→ RSA-2048 key exchange
→ Zero-knowledge architecture
→ Auditable, open protocol
```

Uses `useState` + `useEffect` with a `setInterval`. Each transition fades via CSS `opacity` transition.

**Why it matters:** Static text is ignored. Cycling text draws the eye and communicates depth. A judge who sees 4 different crypto claims in 10 seconds thinks: *"They actually know what they're doing."*

### 2.4 — Scroll-Triggered Feature Card Animations ✅

**File:** `vaultdrive_client/src/pages/home.tsx`

Built a lightweight `useInView()` hook using Intersection Observer. All feature sections fade in with staggered delays as the user scrolls:

```tsx
function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}
```

Each feature card gets `opacity: 0` by default and transitions to `opacity: 1` when `inView` becomes true. Staggered delays (0ms, 100ms, 200ms, 300ms) create a cascade.

**Why it matters:** Content that appears all at once looks like a page load. Content that reveals itself as you scroll looks like a *presentation*.

### 2.5 — Provable Security Architecture Section ✅

**File:** `vaultdrive_client/src/pages/home.tsx`

Replaced the generic "About" section with a checklist of 6 verifiable architectural claims:

- ✅ Browser-side AES-256-GCM encryption before upload
- ✅ RSA-2048 key wrapping for secure sharing
- ✅ Server stores only ciphertext — zero plaintext access
- ✅ PIN-gated owner flows for day-to-day operations
- ✅ Scoped, revocable agent API keys for automation
- ✅ End-to-end encrypted share links with fragment keys

**Why it matters:** Marketing says "we're secure." Architecture checklists prove it. A security-savvy judge will read this list and think: *"They actually built all of this."*

### 2.6 — Expanded Tech Stack Grid ✅

**File:** `vaultdrive_client/src/pages/home.tsx`

Expanded from 2 cards (Backend/Frontend) to a 2×2 grid with 4 categories:

| Backend | Frontend | Security | Developer Experience |
|---------|----------|----------|---------------------|
| Go 1.25 | React 18 | AES-256-GCM | 6 CSS themes |
| PostgreSQL | Vite 6 | RSA-2048 | i18n EN/ES-MX |
| goose migrations | React Router 7 | SHA-256 KDF | 41/41 E2E |
| Net/http | framer-motion | Zero-knowledge | Agent API keys |

Also fixed factual error: removed "React 19" reference (codebase uses React 18).

---

## Verification Results

| Check | Expected | Result | How Verified |
|-------|----------|--------|--------------|
| Hero gradient animates | Slow color shift visible | ✅ Pass | Loaded page, observed 15s cycle |
| Feature cards animate on scroll | Cards fade in with stagger | ✅ Pass | Scrolled down slowly, observed cascade |
| Copy updated | New differentiating language | ✅ Pass | Read the page |
| Encryption trust signal | Cycling badge visible | ✅ Pass | Watched badge cycle through 4 claims |
| Factual accuracy | React 18, no wrong versions | ✅ Pass | Read tech stack section |
| TypeScript | Clean compile | ✅ Pass | `npx tsc -b --noEmit` |
| Vitest | 116/116 | ✅ Pass | `npm run test` |
| Build | Production clean | ✅ Pass | `npm run build` |

---

## Risk Assessment

**Risk: None realized.** Pure frontend changes. No backend. No data model. All changes are in `home.tsx` and CSS.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| 2026-05-21 | Animated hero gradient | ✅ | `aff37ae` |
| 2026-05-21 | Complete hero copy rewrite | ✅ | `aff37ae` |
| 2026-05-21 | Cycling encryption trust signal badge | ✅ | `aff37ae` |
| 2026-05-21 | Scroll-triggered feature card animations | ✅ | `aff37ae` |
| 2026-05-21 | Provable Security Architecture section | ✅ | `aff37ae` |
| 2026-05-21 | Expanded 2×2 tech stack grid | ✅ | `aff37ae` |
| 2026-05-21 | Fixed React 19 → React 18 | ✅ | `aff37ae` |
