# ABRN Drive — Luxury UI Polish + AI Agent API Design

**Date:** 2026-03-23
**Approach:** Sequential — UI polish first, then AI Agent API
**UI Benchmark:** Mercury, Ramp, Linear (luxury fintech tier)
**API Scope:** Developer docs + AI-agent-native (MCP + OpenAPI)

---

## Plan 1: Luxury Fintech UI Polish (7 Steps)

### Step 1: Luxury Design Token System ✅ COMPLETE
- Extended burgundy palette (50–900), warm neutrals, cool slate
- Glassmorphism tokens (backgrounds, borders, blur levels, inner glow)
- Layered warm-tinted shadow system (xs → 2xl + glow variants)
- Dual-font typography (Libre Baskerville display + Inter body)
- Type scale, spacing scale, radius tokens, timing tokens
- Gradient mesh backgrounds for page-level ambient depth
- Framer Motion spring presets (gentle, snappy, dramatic, micro)
- Tween presets, composite transitions, variant library
- `usePrefersReducedMotion` hook + reduced motion fallbacks
- Legacy elegant system bridged to luxury tokens
- **Files:** `luxury-tokens.css`, `motion-presets.ts`, `usePrefersReducedMotion.ts`
- **Tests:** 27/27 unit tests, TypeScript clean, Vite build clean, Go backend clean

### Step 2: Glass Panel Components + Elevated Cards
- `GlassPanel` component: frosted glass with backdrop-blur(16px), subtle border, inner glow
- `ElevatedCard`: replaces current cards with layered shadows, hover lift, press animation
- `LuxuryModal`: glass panel overlay with spring-animated entry/exit
- Dashboard layout: glass sidebar, elevated content area, gradient mesh background
- Dark mode: glass effects intensify

### Step 3: Micro-Interactions + State Transitions
- Button press: scale(0.97) + shadow reduction, spring bounce release
- Toggle/switch: spring physics with overshoot
- File card hover: lift + glow ring, staggered action buttons
- Upload progress: liquid fill with shimmer sweep
- Navigation: page crossfade with AnimatePresence
- Skeleton loaders: warm glass shimmer
- Success: particle burst. Error: gentle shake

### Step 4: Dashboard + Home Page Luxury Treatment
- Gradient mesh background with animated color drift
- Security posture: radial gauge with animated arc fill
- Quick stats: counter animations, staggered card entry
- Recent files: elevated cards with color-coded file-type icons
- Activity feed: timeline with animated indicators
- Attention block: warm amber glow border, pulse on first view

### Step 5: Vault Explorer + File Management Polish
- File tree: animated expand/collapse, selected item glow
- File list: glass-row hover, spring checkbox animation
- Bulk action bar: spring slide-up, glass background
- File preview: edge-to-edge glass panel, zoom gestures
- Upload dropzone: gradient border animation, particle drop effect
- Share modal: stepped wizard with progress dots

### Step 6: Settings, Admin, & Secondary Pages
- Settings: pill-style animated tab indicator
- Form inputs: floating labels, focus glow
- Admin table: glass-row alternating, smooth inline edit
- Profile: avatar ring animation, stat counters
- Groups: overlapping avatar stack, glass cards
- Login: full-bleed gradient mesh, centered glass card
- Onboarding: horizontal slide + fade step transitions

### Step 7: Performance + Bundle Optimization + Final QA
- Dynamic imports: lazy-load Settings, Admin, FilePreviewModal, ShareModal
- `prefers-reduced-motion` graceful degradation
- Lighthouse audit: target 90+ performance, 100 accessibility
- Glass fallback: solid backgrounds on GPU-limited devices
- Dark mode verification pass
- E2E regression: all 32 Playwright tests green
- Visual snapshot baselines

---

## Plan 2: AI Agent API Access — Unified Platform (7 Steps)

### Step 1: OpenAPI 3.1 Specification
- Document all `/api/v1/` endpoints with request/response schemas
- Include auth methods (JWT + Agent API Key with scopes)
- Define error response envelope
- Generate from existing Go handlers + sqlc models
- Output: `openapi.yaml` at project root

### Step 2: Interactive API Documentation (Swagger/Redoc)
- Serve Swagger UI at `/api/docs`
- Serve Redoc at `/api/redoc` (alternative view)
- Include "Try It" with test credentials
- Auto-generate from openapi.yaml
- Version badge + changelog section

### Step 3: SDK Snippets + Quick Start Guide
- cURL, Python (requests), JavaScript (fetch), Go (net/http) snippets
- Auth flow example (create key → use key → introspect)
- File upload with encryption example
- Share link creation example
- Rate limiting headers documentation

### Step 4: Webhook Callbacks
- New endpoint: POST `/api/v1/webhooks` (CRUD)
- Events: file.uploaded, file.shared, file.downloaded, share.created, share.revoked
- Signature verification (HMAC-SHA256)
- Retry policy (3 attempts, exponential backoff)
- Webhook logs + delivery status

### Step 5: MCP Server (Model Context Protocol)
- ABRN Drive as an MCP tool server
- Tools: list_files, upload_file, download_file, share_file, create_share_link, list_shares, revoke_share, list_groups, create_upload_link
- Each tool maps to existing `/api/v1/` endpoint
- Auth via agent API key in MCP config
- Stdio transport for local, SSE for remote

### Step 6: Function-Calling Tool Definitions
- OpenAI-compatible function schemas for all tools
- Claude tool_use format definitions
- Tool descriptions optimized for LLM comprehension
- Include parameter constraints and examples
- Publish as JSON schema files

### Step 7: Rate Limiting + Monitoring + Developer Portal
- Rate limiting: 100 req/min per key (configurable per scope)
- Response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- Usage dashboard in Settings > Advanced tab
- API key analytics: requests/day, top endpoints, error rates
- Developer landing page at `/developers`

---

## Decision Log

| Decision | Choice | Why |
|----------|--------|-----|
| UI approach | Design system first, cascade | Consistency from day one |
| API approach | Unified platform | One source of truth for docs + MCP |
| Execution order | Sequential (UI → API) | UI polish has no API dependency |
| Body font | Inter | Optical sizing, luxury readability, pairs well with Baskerville |
| Motion library | Framer Motion (existing) | Already in deps, spring physics built-in |
| Dark mode tokens | `.dark` class | Consistent with existing app theme toggle |
