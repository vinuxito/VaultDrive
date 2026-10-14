---
name: filemon-remote-mobile
description: >-
  Autonomous Remote Mobile Cloud testing & verification skill. Enables any outside AI
  agent (on any machine, cloud server, or codebase) to test, audit, and interact
  with a live native Android 13 (LineageOS 20) mobile cloud at android.filemonprime.net
  via Remote MCP or zero-dependency CLI without local ADB or emulator dependencies.
---

# Filemón Remote Mobile Cloud — Autonomous Mobile Testing Skill

> **Target:** `https://android.filemonprime.net/`  
> **Engine:** Sovereign Waydroid Android 13 (LineageOS 20) with Hardware GPU Acceleration  
> **Target Audience:** Any AI agent (Claude Code, Cursor, Windsurf, Antigravity, OpenCode, Custom Agents) or human developer operating outside this server.  
> **Operating Doctrine:** *"Maximum system capability converted into minimum human effort. State pure semantic intent; let the remote cloud handle physical touches, safe areas, and 8K visual evidence."*

---

## 1. ARCHITECTURAL OVERVIEW

Traditional mobile testing forces you or your AI agent to run local Android emulators, configure USB debugging, manage ADB tunnels, or calculate raw physical pixel coordinates. 

The **Filemón Remote Mobile Cloud** replaces all of that with a centralized, sovereign Android 13 device cloud accessible over HTTPS:

```
+-----------------------------------------------------------------------------------+
|                        EXTERNAL AI AGENT (ANY MACHINE/FLEET)                      |
|                                                                                   |
|  * Running on MacBook, Windows, Linux VPS, or remote fleet (quantixmexico.com)     |
|  * Uses Remote MCP Tools OR Zero-Dependency Python Client                         |
|  * States Pure Semantic Intent: tap("#menu"), open("https://mysite.com")         |
+-----------------------------------------+-----------------------------------------+
                                          | HTTPS / WSS (Bearer Token)
                                          v
+-----------------------------------------------------------------------------------+
|               APACHE TLS GATEWAY (https://android.filemonprime.net/)              |
|                                                                                   |
|  * Strict Bearer Token Gate (401 with 0 bytes body on missing/invalid token)     |
|  * Reverse Proxies:                                                               |
|    - /mcp    -> Remote Model Context Protocol Server (Port 9330)                  |
|    - /api/   -> FastBridge Semantic Agent REST API (Port 9330)                    |
|    - /       -> Living Glass HTML5 Canvas Stream & Touch Relay                    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     CENTRALIZED ANDROID 13 DEVICE CLOUD                           |
|                                                                                   |
|  * Native Android 13 (LineageOS 20) on Weston 13 Compositor (:10.0)               |
|  * Mobile Chrome Rendering Engine + CDP Element Resolver                          |
|  * Auto-translates CSS selectors -> Physical Screen Touches (DPR: 1.125)          |
|  * Uncompressed 8K Raw Framebuffer Captures (direct from kernel driver)          |
|  * 6-Heuristic Autonomous Mobile Health Engine (Fitts's Law, Nav Clearance)      |
+-----------------------------------------------------------------------------------+
```

---

## 2. QUICK INSTALLATION (OUTSIDE THIS SERVER)

### Option A: 1-Line Installer
On any machine with bash and curl:
```bash
curl -sSL https://android.filemonprime.net/install.sh | bash
```

### Option B: Drop Skill Folder into Your Agent
Copy the `filemon-remote-mobile/` directory into your project's skill registry:
- **Antigravity / Gemini CLI:** `.agents/skills/filemon-remote-mobile/`
- **Claude Code:** `skills/filemon-remote-mobile/` or register via MCP
- **Cursor / Windsurf:** `.cursor/skills/filemon-remote-mobile/`

### Option C: Authentication Setup
Set the Bearer Token in your environment:
```bash
export FILEMON_MOBILE_TOKEN="YOUR_BEARER_TOKEN"
```
*(Token can also be saved permanently in `~/.filemon_mobile_token`)*

---

## 3. INTEGRATION MODE 1: REMOTE MODEL CONTEXT PROTOCOL (MCP)

This is the **zero-friction mode for LLM agents**. When registered, your AI assistant receives 5 high-level native mobile tools directly in its prompt context.

### Registering in Claude Code
Add to `~/.claude.json` or your project `.claude.json`:
```json
{
  "mcpServers": {
    "filemon-mobile": {
      "command": "python3",
      "args": ["/path/to/filemon-remote-mobile/scripts/mcp_stdio_proxy.py"],
      "env": {
        "FILEMON_MOBILE_TOKEN": "YOUR_BEARER_TOKEN"
      }
    }
  }
}
```

### Registering in Cursor / Windsurf
Add to `~/.cursor/mcp.json` or `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "filemon-mobile": {
      "command": "python3",
      "args": ["/path/to/filemon-remote-mobile/scripts/mcp_stdio_proxy.py"],
      "env": {
        "FILEMON_MOBILE_TOKEN": "YOUR_BEARER_TOKEN"
      }
    }
  }
}
```

### Available MCP Tools

#### 1. `android_open_url`
Opens any URL in native Android 13 Chrome and waits for network idle.
- `url` (string, required): Destination web address.
- `wait_ms` (integer, optional, default: 1200): Milliseconds to wait for DOM settle.

#### 2. `android_semantic_tap`
Finds a DOM element by CSS selector on the active mobile screen, computes physical touch coordinates, and executes a hardware touch.
- `selector` (string, required): Standard CSS selector (e.g. `"#checkout-btn"`, `".hamburger"`).
- `url` (string, optional): Target URL context.

#### 3. `android_take_screenshot`
Captures an uncompressed, cold-reality raw framebuffer screenshot directly from the Android kernel display driver.
- `as_base64` (boolean, optional, default: true): Returns base64 PNG data.

#### 4. `android_audit_flow`
Executes an automated mobile user journey, validating safe-area clearances, virtual keyboard occlusion, and touch responses.
- `url` (string, required): Starting page URL.
- `flow` (array of strings, required): Sequential actions (e.g. `["tap:#menu", "wait:400", "tap:#pricing"]`).
- `assert_no_occlusion` (boolean, optional, default: true): Checks for collisions with system nav bars.

#### 5. `android_evaluate_js`
Evaluates JavaScript directly in the active Android mobile browser tab via Chrome DevTools Protocol.
- `script` (string, required): JavaScript expression to run.

---

## 4. INTEGRATION MODE 2: ZERO-DEPENDENCY PYTHON CLI

For terminal automation, CI/CD pipelines, or agents executing shell commands. Requires **zero pip packages** (Python 3.8+ standard library only).

Script location: `scripts/filemon_mobile_client.py`

### CLI Cheat Sheet

```bash
# 1. Check cloud device status and active Chrome tab
./filemon_mobile_client.py status

# 2. Open any web application on mobile
./filemon_mobile_client.py open "https://quantixmexico.com/"
./filemon_mobile_client.py open "https://clipboard.filemonprime.net/" --wait 2000

# 3. Tap elements semantically (no coordinates required!)
./filemon_mobile_client.py tap "#primary-nav-btn"
./filemon_mobile_client.py tap ".cart-item:first-child .delete-btn"

# 4. Type text into input fields
./filemon_mobile_client.py type "user@example.com" --selector "#email-input"
./filemon_mobile_client.py type "SecretPassword123"

# 5. Dispatch hardware buttons
./filemon_mobile_client.py key back     # Dismiss modals / virtual keyboard
./filemon_mobile_client.py key home     # Return to Android home screen
./filemon_mobile_client.py key enter    # Submit form
./filemon_mobile_client.py key menu     # App switcher

# 6. Capture cold 8K reality framebuffer screenshot
./filemon_mobile_client.py screenshot evidence.png
./filemon_mobile_client.py screenshot --json

# 7. Run 6-heuristic autonomous mobile UX audit
./filemon_mobile_client.py audit "https://quantixmexico.com/"

# 8. Execute sequential mobile journey
./filemon_mobile_client.py flow "https://quantixmexico.com/" \
  --steps "tap:#open-drawer,wait:500,tap:#pricing-link,wait:800"
```

---

## 5. INTEGRATION MODE 3: THE LIVING GLASS (WEB CANVAS)

For human operators and visual verification agents:
Open in any browser:
```
https://android.filemonprime.net/?token=YOUR_BEARER_TOKEN
```
Features:
- **Photorealistic Smartphone Chassis:** Bezel-framed mobile viewport streaming the native Android display.
- **Sub-Pixel Touch & Drag:** Click or swipe directly on the canvas; events translate to hardware touch gestures.
- **Hardware Nav Keys:** ◀ (Back), ● (Home), ■ (Recents).
- **Ambient Clipboard Teleportation:** Teleport text from your local computer into Android in 1 click.
- **`[⚡ Autonomous Audit]` HUD:** 1-click inspection running the 6 heuristic probes and displaying an animated mobile health scorecard.

---

## 6. THE 6-HEURISTIC MOBILE HEALTH STANDARDS

When testing mobile web applications, this skill evaluates the following hardware-level heuristics:

1. **System Navigation Bar Collision (Y ≥ 912px):**
   Android system navigation buttons (Back, Home, Recents) consume `Y: 912px - 960px`. Interactive bottom toolbars, submit buttons, or tabs must maintain safe-area padding (`env(safe-area-inset-bottom)`) so users do not accidentally trigger system navigation instead of your button.
2. **Touch Target Dimensions (WCAG 2.2 AA / Fitts's Law):**
   Interactive touch targets must maintain a minimum physical patch of 44x44px (minimum 32x32px for compact icons).
3. **Horizontal Viewport Spill (0px Spill Standard):**
   Mobile web pages must scroll strictly vertically. Elements exceeding `100vw` or unconstrained wide tables that cause horizontal wobbling are flagged immediately.
4. **Input Font-Size Auto-Zoom Risk:**
   Inputs and textareas with `font-size < 16px` trigger disruptive mobile browser auto-zooming. The engine enforces `font-size ≥ 16px` on mobile viewports.
5. **Virtual Keyboard Inset Resilience:**
   Verifies that modals and input forms do not get squashed or pushed off-screen when the virtual keyboard consumes 350-500px of screen height.
6. **Viewport Meta Fit:**
   Ensures `<meta name="viewport">` declares `width=device-width, viewport-fit=cover, interactive-widget=resizes-content`.

---

## 7. PYTHON SDK USAGE EXAMPLE

Outside scripts or autonomous test runners can import the client directly:

```python
from filemon_mobile_client import FilemonMobileClient

client = FilemonMobileClient(
    endpoint="https://android.filemonprime.net",
    token="YOUR_BEARER_TOKEN"
)

# 1. Check status
print(client.status())

# 2. Open page
client.open_url("https://quantixmexico.com/checkout")

# 3. Semantic tap
client.tap("#promo-code-btn")

# 4. Fill text
client.type_text("DISCOUNT2026", selector="#promo-input")

# 5. Capture uncompressed visual evidence
client.screenshot("docs/reports/screenshots/checkout-test.png")

# 6. Close / back
client.press_key("back")
```

---

## 8. SECURITY & TROUBLESHOOTING

- **Strict Bearer Token Auth:** Every API, MCP, and WebSocket request requires `Authorization: Bearer <TOKEN>`. Unauthenticated requests immediately return **401 Unauthorized with 0 bytes body** before touching any internal process.
- **Connection Error (Exit 2):** Ensure the machine has outbound HTTPS (port 443) access to `android.filemonprime.net`.
- **Element Not Found (404):** The selector did not match any DOM node in the active mobile tab. Verify selector via `eval` or inspect using `screenshot`.
- **Zero-Fixture Leak Standard:** When automating tests or adding temporary clips, ensure your test runner cleans up artifacts immediately.

---

## 9. ABRN-DRIVE (VAULTDRIVE) REMOTE MOBILE AUDIT TARGETS

When running `filemon_mobile_client.py` against ABRN-Drive (`https://abrn.filemonprime.net`):

```bash
# 1. Run 6-heuristic mobile health audit on Login & Landing
python3 .agents/skills/filemon-remote-mobile/scripts/filemon_mobile_client.py audit "https://abrn.filemonprime.net/login"

# 2. Verify Couch-Approved Login Fold & BottomNav Omnibar Trigger
python3 .agents/skills/filemon-remote-mobile/scripts/filemon_mobile_client.py flow "https://abrn.filemonprime.net/login" \
  --steps "wait:1500,screenshot:/tmp/abrn-login-mobile.png"
```

Key selectors in ABRN-Drive mobile views:
- `[data-testid="bottom-nav-search"]` — Launches `VaultOmnibar` (`El Cerebro Ciego`) from any route (navigating to `/files` automatically if needed).
- `[data-testid="open-omnibar-btn"]` — Header pill button in `FileSearch.tsx` to open `VaultOmnibar`.
- `[data-testid="triage-auto-rename-btn"]` — 1-tap auto-rename button in the upload modal powered by `document-triage.ts`.

