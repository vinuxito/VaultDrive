#!/usr/bin/env python3
"""
Filemón Mobile Cloud — Python Quickstart Example
Shows how an outside script or AI agent calls the Android 13 cloud programmatically.
"""

import os
import sys

# Add scripts directory to import path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from filemon_mobile_client import FilemonMobileClient

def main():
    # 1. Initialize client (reads FILEMON_MOBILE_TOKEN from environment)
    client = FilemonMobileClient(
        endpoint="https://android.filemonprime.net",
        token=os.environ.get("FILEMON_MOBILE_TOKEN")
    )

    print("[*] Probing Android 13 Device Cloud...")
    status = client.status()
    print(f"    Engine: {status.get('engine')} | CDP: {status.get('cdp_active')}")

    # 2. Open any web URL in native Android Chrome
    target_url = "https://clipboard.filemonprime.net/"
    print(f"[*] Navigating to {target_url}...")
    client.open_url(target_url)

    # 3. Tap elements semantically using pure CSS selectors (no raw coordinates!)
    print("[*] Tapping '#thumb-btn-new-item' on mobile screen...")
    res = client.tap("#thumb-btn-new-item")
    pt = res.get("physical_tap", {})
    print(f"    Physical touch registered at (X={pt.get('x')}, Y={pt.get('y')})")

    # 4. Capture 8K reality framebuffer screenshot
    out_img = "evidence.png"
    client.screenshot(out_img)
    print(f"[*] Visual evidence saved to {out_img} ({os.path.getsize(out_img):,} bytes)")

    # 5. Dismiss sheet
    client.press_key("back")
    print("[*] Dispatched Android 'back' key to dismiss sheet.")

if __name__ == "__main__":
    main()
