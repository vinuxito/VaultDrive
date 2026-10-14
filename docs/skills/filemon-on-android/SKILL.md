---
name: filemon-on-android
description: >-
  Universal operational protocol and runbook for testing, operating, automating,
  and verifying any web application or service on native Android 13 (LineageOS 20)
  via Waydroid, Weston X11 (:10.0), ADB bridge, and Chrome DevTools Protocol.
  Available globally across all projects on this server.
---

# Filemón on Android — Universal Mobile Automation & Verification Skill

> **Universal Server Operational Protocol • Multi-Project Mobile Testing**  
> *"Maximum system capability converted into minimum human effort. Test on the real thing without building wrapper cruft."*

---

## 1. ARCHITECTURAL OVERVIEW & ENVIRONMENT REALITY

This Ubuntu Linux host runs a genuine, containerized **Android 13 (LineageOS 20 with GAPPS)** environment via Waydroid. It renders directly into the user's active XRDP desktop session via a nested **Weston 13** Wayland compositor, giving any AI agent on any project direct programmatic and visual access to a real mobile runtime.

```
+-----------------------------------------------------------------------------------+
|                                 UBUNTU HOST VPS                                   |
|                                                                                   |
|  +--------------------+                     +----------------------------------+  |
|  | KDE / X11 (:10.0)  | <-----------------+ | Weston 13 Wayland Compositor     |  |
|  | User XRDP Session  | (480x960 portrait)  | Socket: /run/user/1001/wayland-1 |  |
|  +--------------------+                     +-----------------+----------------+  |
|                                                               ^                   |
|                                                               | Wayland protocol  |
|                                                               v                   |
|  +------------------------------------------------------------+----------------+  |
|  | Waydroid LXC Container (systemd: waydroid-container.service)                 |  |
|  | IP: 192.168.240.112 (DHCP on waydroid0 bridge: 192.168.240.1)                |  |
|  |                                                                              |  |
|  |   [Android 13 LineageOS 20 System]                                           |  |
|  |   * Chrome / WebView: Native mobile rendering engine                         |  |
|  |   * ADB Daemon: listening on 192.168.240.112:5555 (persisted)                |  |
|  |   * Chrome Remote Debugging (CDP): localhost:9222 via adb forward            |  |
|  |   * Direct Framebuffer: screencap -p (uncompressed raw mobile pixels)        |  |
|  +------------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. WHEN TO USE THIS SKILL

Any agent working on **any repository or project under `/lamp/www/` or localhost** (e.g., `uremoteclipboard`, `nanored`, `quantix`, `real_state_crm`, `garcesmena_com`, etc.) must activate this skill when:
1. **Verifying Mobile Responsiveness:** Ensuring web layouts adapt cleanly without horizontal scrolling, broken line wraps, or occluded viewports on a true mobile screen.
2. **Testing Touch Interactions:** Simulating genuine touch events (`tap`, `swipe`, gestures, pull-to-refresh) rather than desktop mouse clicks.
3. **Evaluating Mobile Browser Quirks:** Testing viewport meta tags, font scaling, virtual keyboard behaviors, and CSS media queries (`max-width: 980px`, `@media (hover: none)`).
4. **Verifying Real-Time Events on Mobile:** Testing Server-Sent Events (SSE), WebSockets, or live notifications on a live mobile client.
5. **Capturing Cold Visual Evidence:** Extracting raw framebuffer screencaps to prove completion under the **8K Reality** standard.

---

## 3. GLOBAL COMMAND-LINE INTERFACE (`filemon-mobile` / `urc-mobile`)

Two identical CLI wrappers are installed globally in `/home/vinuxito/.local/bin/` (in `$PATH`):
- `filemon-mobile` (universal name for all projects)
- `urc-mobile` (legacy project alias)

### Quick Reference Command Cheat Sheet

```bash
# 1. Check complete mobile runtime health
filemon-mobile status
filemon-mobile status --json

# 2. Start the mobile runtime (Weston compositor + Waydroid Android 13)
filemon-mobile start

# 3. Raise & focus the Android window above all desktop windows
filemon-mobile raise

# 4. Open ANY web application URL in the Android browser
filemon-mobile url "https://clipboard.filemonprime.net/"
filemon-mobile url "https://dev-app.filemonprime.net/my-project/"
filemon-mobile url "http://192.168.240.1:8080/test-page"

# 5. Capture an uncompressed Android framebuffer screenshot
filemon-mobile screenshot docs/reports/screenshots/mobile-evidence.png

# 6. Touch and gesture simulation
filemon-mobile tap 240 480                     # Tap at X=240, Y=480
filemon-mobile swipe 240 700 240 250 300       # Scroll down (drag up) in 300ms
filemon-mobile swipe 240 250 240 700 300       # Scroll up (drag down) in 300ms
filemon-mobile text "Test input string"        # Type text into focused field

# 7. Hardware key events
filemon-mobile key 4                           # Back key (Android keycode 4)
filemon-mobile key 3                           # Home key (Android keycode 3)
filemon-mobile key 187                         # App Switcher / Recents (keycode 187)
filemon-mobile key 66                          # Enter key (keycode 66)

# 8. Clean stop and restart
filemon-mobile stop                            # Stop Waydroid session & Weston
filemon-mobile restart                         # Clean sequential stop & start

# 9. Audit reboot persistence
filemon-mobile boot-check                      # Validates 6/6 persistence gates
```

---

## 4. SCREEN GEOMETRY & COORDINATE REFERENCE (480x960 PORTRAIT)

The Waydroid container is locked to **480x960 portrait** (`persist.waydroid.width=480`, `persist.waydroid.height=960`).

```
(0,0) +---------------------------------------+ (480,0)
      | [10:18] Status Bar (clock, battery)  |  Y: 0 - 48px
      +---------------------------------------+
      | Chrome Address Bar & Tabs             |  Y: 48 - 112px
      +---------------------------------------+
      |                                       |
      |                                       |
      |       ACTIVE WEB APPLICATION          |  Y: 112 - 912px
      |       VIEWPORT (480 x 800)            |
      |                                       |
      |       Center Screen: (240, 500)       |
      |                                       |
      |                                       |
      +---------------------------------------+
      | Bottom Navigation / FAB Bar           |  Y: 880 - 912px
      +---------------------------------------+
      | Android System Navigation Bar         |  Y: 912 - 960px
(0,960)+---------------------------------------+ (480,960)
```

### Common Normalized Touch Coordinates
| Target UI Element | Typical Coordinates | CLI Command |
|---|---|---|
| **Top Header Action** | `X=240, Y=140` | `filemon-mobile tap 240 140` |
| **Top-Right Menu / Gear** | `X=440, Y=140` | `filemon-mobile tap 440 140` |
| **Center of Screen** | `X=240, Y=500` | `filemon-mobile tap 240 500` |
| **First Item in Feed** | `X=240, Y=260` | `filemon-mobile tap 240 260` |
| **Bottom Central Action / FAB** | `X=240, Y=900` | `filemon-mobile tap 240 900` |
| **Scroll Down (Page Down)** | Swipe `(240, 750) -> (240, 250)` | `filemon-mobile swipe 240 750 240 250 300` |
| **Scroll Up (Page Up)** | Swipe `(240, 250) -> (240, 750)` | `filemon-mobile swipe 240 250 240 750 300` |

---

## 5. PROGRAMMATIC AUTOMATION VIA CHROME DEVTOOLS PROTOCOL (CDP)

When an agent needs to inspect DOM elements, evaluate JavaScript, read console logs, or dispatch precise DOM events on Android:

### 1. Forward Android Chrome Debug Port
```bash
/lamp/www/uremoteclipboard/bin/adb forward tcp:9222 localabstract:chrome_devtools_remote
```

### 2. Discover Open Android Pages
```bash
curl -s http://127.0.0.1:9222/json
```
*Returns a JSON array of active browser tabs with their `webSocketDebuggerUrl` (e.g. `ws://127.0.0.1:9222/devtools/page/3`).*

### 3. Evaluate Script or Inspect State (Python One-Liner)
```bash
python3 -c '
import asyncio, json, websockets
async def run():
    async with websockets.connect("ws://127.0.0.1:9222/devtools/page/3") as ws:
        js = "document.title"
        await ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": js}}))
        res = await ws.recv()
        print("Page Title:", json.loads(res)["result"]["result"]["value"])
asyncio.run(run())
'
```

### 4. Trigger Hard Reload on Android
```bash
python3 -c '
import asyncio, json, websockets
async def run():
    async with websockets.connect("ws://127.0.0.1:9222/devtools/page/3") as ws:
        await ws.send(json.dumps({"id": 1, "method": "Page.reload", "params": {"ignoreCache": True}}))
        await ws.recv()
asyncio.run(run())
'
```

---

## 6. THE 5-STEP UNIVERSAL VERIFICATION RECIPE (ANY PROJECT)

Whenever implementing or verifying a feature on this server:

```
[1. START]       filemon-mobile start && filemon-mobile raise
                   |
[2. NAVIGATE]    filemon-mobile url "https://<your-project-domain>/"
                   |
[3. SETTLE]      sleep 2
                   |
[4. INTERACT]    filemon-mobile tap <x> <y>  (or swipe / text)
                   |
[5. EVIDENCE]    filemon-mobile screenshot docs/reports/screenshots/<feature>-android.png
```

Always inspect the captured PNG with `view_file` to verify that the rendered result meets high-status UI standards before closing your task.

---

## 7. PERSISTENCE & HARDWARE INVARIANTS

The mobile environment is engineered to survive machine reboots automatically:
1. **Systemd Unit:** `waydroid-container.service` is `enabled` on `multi-user.target`.
2. **Network Forwarding:** `/etc/systemd/system/waydroid-container.service.d/network-forward.conf` injects iptables FORWARD and NAT MASQUERADE rules on container startup to prevent Docker from severing Android WAN access.
3. **Permanent ADB Authorization:** Host RSA key `vinuxito@vps3224077` is permanently enrolled in `/data/misc/adb/adb_keys`.
4. **Permanent Viewport:** `persist.waydroid.width = 480`, `persist.waydroid.height = 960`.
5. **KDE Desktop Launchers:** Clickable `.desktop` launchers are present on the desktop at `~/Desktop/` (`Start`, `Stop`, `Restart`, `Show`, `Console`).

---

## 8. DRIFT RECOVERY & TROUBLESHOOTING

| Symptom | Probable Cause | Exact Fix |
|---|---|---|
| **Black or empty Weston screen** | Weston was started before Waydroid surface initialized. | Run `filemon-mobile raise`. If still blank, run `filemon-mobile restart`. |
| **"failed to connect to 192.168.240.112:5555" (No route to host)** | The Android bridge may have dropped after the container stopped unexpectedly. | Run `sudo systemctl restart waydroid-container` and then `filemon-mobile restart`; authenticate through the normal sudo prompt. |
| **SurfaceFlinger crash / DEAD_OBJECT crash loop** | Weston's desktop-shell top panel reserved 32px (480x928), causing Waydroid (480x960) to trigger an XDG Shell protocol violation. | Ensure `~/.config/weston.ini` has `[shell] panel-position=none` so the full 480x960 canvas is unhindered. |
| **Zygote crash / "Boot classpath is empty"** | An invalid `$HOME` was passed to waydroid session, splitting dalvik-cache. | Ensure `HOME=/home/vinuxito` is set (already handled by `filemon-mobile`). |
| **Weston behind other windows** | KDE window stacking order. | Run `filemon-mobile raise` (uses KWin qdbus scripting to keep Weston above other clients). |
| **Android browser doesn't load localhost domain** | Container DNS cannot resolve custom vhost name. | Use VPS WAN IP, registered `.filemonprime.net` domain with wildcard SSL, or gateway IP `192.168.240.1`. |

---

## 9. LAW OF ZERO-LEAK TESTING

When writing automated tests against the mobile container:
1. All test records, files, or clips created on Android or the backend MUST be purged immediately upon test completion.
2. Never leave temporary screenshots in tracked repository folders; store them under `docs/reports/screenshots/` or `/tmp/`.

---

## 10. ABRN-DRIVE (VAULTDRIVE) ANDROID 13 VERIFICATION PLAYBOOK

When verifying `/lamp/www/ABRN-Drive` on native Android 13 (`480×960` portrait):

1. **WebCrypto Secure Context (`window.crypto.subtle`):**
   - ABRN-Drive requires WebCrypto AES-256-GCM for login key unwrap and file encryption.
   - Either access via `https://abrn.filemonprime.net` OR bridge local port `8082` over ADB reverse (`adb -s 192.168.240.112:5555 reverse tcp:8082 tcp:8082`) and navigate to `http://127.0.0.1:8082` (`127.0.0.1` is treated by Android Chromium as a secure context).
2. **Critical Mobile Checkpoints for ABRN-Drive:**
   - `/login`: Verify 100% of Email/Password + PIN segmented toggle + submit button fit above `Y=912px` without scrolling when keyboard is closed.
   - `/files`: Verify `BottomNav` Search tap (`[data-testid="bottom-nav-search"]`) opens `VaultOmnibar` (`El Cerebro Ciego`) from any route, and verify single-surface `MobileProofPill` after upload (no double-modal collision over the FAB).
   - `VaultPrivacyShutter`: Verify 4x3 `SovereignPinPad` unlocks on the 4th digit without triggering the Android OS soft keyboard.
   - `MobileShareSheet`: Verify `48px` touch targets for WhatsApp deep link and Web Share API.

