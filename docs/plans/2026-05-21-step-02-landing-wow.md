# Step 2 — Landing Page: The 5-Second Wow

**Parent:** [Hackathon Index](./2026-05-21-hackathon-index.md)  
**Priority:** 🔴 Critical  
**Effort:** M (1 day)

---

## Why This Matters

The landing page (`/quantix/` → `home.tsx`) is the first thing a judge sees. Right now it's functional and clean — branded logo, feature cards, tech stack section, footer. But it reads like a README rendered as HTML.

For a hackathon, the landing page needs to make the judge think: *"Wait, this was built in a hackathon?"* It needs to feel like a $50M product launch page, not a student project.

---

## Current State (Verified)

**File:** `vaultdrive_client/src/pages/home.tsx` (190 lines)

- Hero: BrandLogo (SVG), badge, `h1`, subtitle, two buttons (GitHub, Get Started).
- Features: 4 glass cards in a grid (Secure Auth, File Management, Encryption, Sharing).
- Tech Stack: 2 glass cards (Backend, Frontend) with bullet lists.
- About: Single glass card with product description.
- Footer: `<LandingPageFooter />` component.

**Problems:**
1. **Static.** Nothing moves. Nothing breathes. It feels like a template.
2. **Generic copy.** "Enterprise-grade secure cloud storage" — every SaaS product says this.
3. **No social proof / trust signal** beyond the GitHub link.
4. **No visual hierarchy.** Feature cards are equal weight — nothing pulls the eye.
5. **"React 19" reference** in about section is wrong (the app uses React 18).
6. **Hero CTA** "Get Started →" is fine but doesn't communicate the zero-knowledge differentiator.

---

## Success Condition

After this step:
1. The hero section has a subtle **animated gradient** or particle effect that makes it feel alive.
2. Feature cards **animate in on scroll** (intersection observer, not a library).
3. The copy is sharp and differentiating — not generic SaaS boilerplate.
4. There is a **live encryption demo** or visual indicator showing "your data is encrypted here, not on our server."
5. The page loads in under 1 second and scores 90+ on Lighthouse.
6. A judge who spends 5 seconds on this page understands: *"This is a zero-knowledge encrypted vault with enterprise sharing."*

---

## Implementation Plan

### 2.1 — Animated Hero Background

**File:** `vaultdrive_client/src/pages/home.tsx`

Add a subtle animated gradient mesh to the hero section. Use CSS `@keyframes` — no JS animation library needed.

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

**Why:** Movement catches the eye. A slow-shifting gradient feels premium without being distracting. It works on every theme because it uses CSS custom properties.

### 2.2 — Rewrite Hero Copy

Replace generic marketing with specific, confident language.

**Before:**
> Enterprise-grade secure cloud storage with zero-knowledge encryption. Built with cutting-edge technology for maximum privacy and security.

**After:**
> Your files are encrypted in your browser before they ever touch our server. We can't read them. Nobody can. Store, share, and collaborate on sensitive data with military-grade encryption — and we'll prove it.

Add a second line under the CTA:
> *"AES-256-GCM encrypted. Zero-knowledge. Auditable."*

### 2.3 — Scroll-Triggered Feature Card Animations

**File:** `vaultdrive_client/src/pages/home.tsx`

Use a lightweight Intersection Observer hook to trigger fade-in animations as the user scrolls.

```tsx
function useInView(ref: React.RefObject<HTMLElement>) {
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

Apply to each feature card section with staggered delays.

### 2.4 — Live Encryption Trust Signal

Add a small animated badge or section near the hero that shows:
```
🔒 Client-side encryption active
    ├─ AES-256-GCM
    ├─ RSA-2048 key exchange
    └─ Zero server-side plaintext
```

This is not just marketing — it's a verifiable architectural claim backed by the codebase. It differentiates QuantiX-Drive from every "we encrypt your data" claim.

### 2.5 — Fix Factual Errors

- Change "React 19" → "React 18" in the about section.
- Verify all tech stack claims match reality.

### 2.6 — i18n Integration

Ensure the landing page copy uses `useTranslation()` for both EN and ES-MX, consistent with the i18n infrastructure already built.

---

## Verification

| Check | Expected | How to verify |
|-------|----------|---------------|
| Hero gradient animates | Slow color shift visible | Load page, observe background |
| Feature cards animate on scroll | Cards fade in with stagger | Scroll down slowly |
| Copy is updated | New differentiating language | Read the page |
| Encryption trust signal | Visible near hero | Visual check |
| Lighthouse score | 90+ performance | Run `lighthouse` audit |
| Factual accuracy | React 18, correct tech stack | Read about section |
| i18n works | Page renders in ES-MX | Switch language, reload |

---

## Risk

**Low.** Pure frontend. No backend changes. No data model changes. All changes are in `home.tsx` and CSS.

---

## Evidence Log

| Date | What was done | Verified? | Commit |
|------|--------------|-----------|--------|
| | | | |
