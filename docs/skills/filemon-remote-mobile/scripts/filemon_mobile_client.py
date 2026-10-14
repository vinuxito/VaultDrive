#!/usr/bin/env python3
"""
Filemón Remote Mobile Client — Zero-Dependency Android 13 Cloud CLI
Connects any outside machine or AI agent to the Autonomous Mobile Device Cloud
hosted at https://android.filemonprime.net/
Requires only Python 3.8+ standard library (no pip dependencies).
"""

import sys
import os
import json
import base64
import argparse
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

DEFAULT_ENDPOINT = "https://android.filemonprime.net"

def resolve_token(arg_token: Optional[str] = None) -> str:
    if arg_token:
        return arg_token.strip()
    env_token = os.environ.get("FILEMON_MOBILE_TOKEN") or os.environ.get("URC_BEARER_TOKEN")
    if env_token:
        return env_token.strip()
    token_file = os.path.expanduser("~/.filemon_mobile_token")
    if os.path.exists(token_file):
        try:
            with open(token_file, "r") as f:
                return f.read().strip()
        except Exception:
            pass
    return ""

class FilemonMobileClient:
    def __init__(self, endpoint: str = DEFAULT_ENDPOINT, token: str = ""):
        self.endpoint = endpoint.rstrip("/")
        self.token = token or resolve_token()

    def _request(self, path: str, method: str = "GET", data: Optional[Dict[str, Any]] = None, is_binary: bool = False) -> Any:
        url = f"{self.endpoint}{path}"
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        body = None
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=15.0) as resp:
                if is_binary:
                    return resp.read()
                raw = resp.read().decode("utf-8")
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return {"raw": raw}
        except urllib.error.HTTPError as e:
            if e.code == 401:
                print("❌ [401 Unauthorized] Missing or invalid Bearer token.", file=sys.stderr)
                print("   Set via: export FILEMON_MOBILE_TOKEN='your_token_here'", file=sys.stderr)
                print("   Or pass: --token 'your_token_here'", file=sys.stderr)
                sys.exit(1)
            raw = e.read().decode("utf-8", errors="ignore")
            try:
                err_data = json.loads(raw)
                return {"ok": False, "error": err_data.get("error", f"HTTP {e.code}"), "status": e.code}
            except Exception:
                return {"ok": False, "error": f"HTTP {e.code}", "details": raw}
        except urllib.error.URLError as e:
            print(f"❌ [Connection Error] Failed to reach {self.endpoint}: {e.reason}", file=sys.stderr)
            sys.exit(2)

    def status(self) -> Dict[str, Any]:
        return self._request("/api/status")

    def open_url(self, url: str, wait_ms: int = 1200) -> Dict[str, Any]:
        return self._request("/api/open", method="POST", data={"url": url, "wait_ms": wait_ms})

    def tap(self, selector: str, url: Optional[str] = None) -> Dict[str, Any]:
        payload = {"selector": selector}
        if url:
            payload["url"] = url
        return self._request("/api/semantic-tap", method="POST", data=payload)

    def type_text(self, text: str, selector: Optional[str] = None) -> Dict[str, Any]:
        payload = {"text": text}
        if selector:
            payload["selector"] = selector
        return self._request("/api/type-text", method="POST", data=payload)

    def press_key(self, key: str) -> Dict[str, Any]:
        return self._request("/api/press-key", method="POST", data={"key": key})

    def screenshot(self, output_path: str = "screenshot.png") -> str:
        data = self._request("/api/screenshot", is_binary=True)
        with open(output_path, "wb") as f:
            f.write(data)
        return output_path

    def evaluate_js(self, script: str) -> Dict[str, Any]:
        return self._request("/api/evaluate-js", method="POST", data={"script": script})

    def audit_flow(self, url: str, flow: list, assert_no_occlusion: bool = True) -> Dict[str, Any]:
        return self._request("/api/audit-flow", method="POST", data={
            "url": url,
            "flow": flow,
            "assert_no_occlusion": assert_no_occlusion
        })

def main():
    parser = argparse.ArgumentParser(
        description="Filemón Remote Mobile Client — Control Android 13 Device Cloud from Any Agent/Machine"
    )
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT, help="Cloud API Base URL")
    parser.add_argument("--token", help="Bearer Token (or env FILEMON_MOBILE_TOKEN)")
    parser.add_argument("--json", action="store_true", help="Output pure JSON")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    subparsers.add_parser("status", help="Check Android 13 cloud device health and active tab")

    # open
    p_open = subparsers.add_parser("open", help="Open a web URL in native Android Chrome")
    p_open.add_argument("url", help="Target URL (e.g. https://quantixmexico.com/)")
    p_open.add_argument("--wait", type=int, default=1200, help="Settle wait in ms (default: 1200)")

    # tap
    p_tap = subparsers.add_parser("tap", help="Tap a DOM element by CSS selector on mobile screen")
    p_tap.add_argument("selector", help="CSS Selector (e.g. '#buy-now', '.menu-toggle')")
    p_tap.add_argument("--url", help="Target URL context")

    # type
    p_type = subparsers.add_parser("type", help="Type text into focused element or active window")
    p_type.add_argument("text", help="Text to type")
    p_type.add_argument("--selector", help="Optional CSS selector to focus first")

    # key
    p_key = subparsers.add_parser("key", help="Dispatch Android hardware keyevent (back, home, enter, menu)")
    p_key.add_argument("key", choices=["back", "home", "enter", "menu", "tab", "delete"], help="Hardware key")

    # screenshot
    p_shot = subparsers.add_parser("screenshot", help="Capture uncompressed 8K raw framebuffer PNG")
    p_shot.add_argument("output", nargs="?", default="screenshot.png", help="Destination file path")

    # eval
    p_eval = subparsers.add_parser("eval", help="Evaluate JavaScript expression in Android Chrome via CDP")
    p_eval.add_argument("script", help="JavaScript code snippet")

    # audit
    p_audit = subparsers.add_parser("audit", help="Run 6-heuristic autonomous mobile UX health check on URL")
    p_audit.add_argument("url", help="Web application URL to audit")

    # flow
    p_flow = subparsers.add_parser("flow", help="Execute an autonomous multi-step mobile user journey")
    p_flow.add_argument("url", help="Starting page URL")
    p_flow.add_argument("--steps", required=True, help="Comma-separated actions (e.g. 'tap:#menu,wait:400,tap:#pricing')")

    args = parser.parse_args()
    client = FilemonMobileClient(endpoint=args.endpoint, token=args.token)

    if args.command == "status":
        res = client.status()
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print("=" * 60)
            print("  FILEMÓN MOBILE CLOUD STATUS")
            print("=" * 60)
            print(f"Endpoint:    {args.endpoint}")
            print(f"Engine:      {res.get('engine', 'Unknown')}")
            print(f"ADB Device:  {res.get('adb_device', 'Unknown')}")
            print(f"CDP Bridge:  {'ACTIVE' if res.get('cdp_active') else 'DISCONNECTED'}")
            tab = res.get("active_tab") or {}
            print(f"Active Tab:  {tab.get('title', 'None')} ({tab.get('url', 'None')})")
            print("=" * 60)

    elif args.command == "open":
        res = client.open_url(args.url, wait_ms=args.wait)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print(f"✓ Opened {args.url} in Android Chrome (Title: {res.get('active_title')})")

    elif args.command == "tap":
        res = client.tap(args.selector, url=args.url)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            if res.get("ok"):
                pt = res.get("physical_tap", {})
                print(f"✓ Semantic Tap resolved on '{args.selector}': physical touch at (X={pt.get('x')}, Y={pt.get('y')})")
            else:
                print(f"❌ Tap failed: {res.get('error')}", file=sys.stderr)
                sys.exit(1)

    elif args.command == "type":
        res = client.type_text(args.text, selector=args.selector)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print(f"✓ Typed '{args.text}' into {args.selector or 'focused element'}")

    elif args.command == "key":
        res = client.press_key(args.key)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print(f"✓ Dispatched keyevent '{args.key}'")

    elif args.command == "screenshot":
        out_file = client.screenshot(args.output)
        if args.json:
            print(json.dumps({"ok": True, "saved_to": out_file, "bytes": os.path.getsize(out_file)}))
        else:
            print(f"✓ Framebuffer captured: {out_file} ({os.path.getsize(out_file):,} bytes)")

    elif args.command == "eval":
        res = client.evaluate_js(args.script)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print(f"Result: {res.get('result')}")

    elif args.command == "audit":
        res = client.audit_flow(args.url, flow=["wait:500"])
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print("=" * 60)
            print(f"  AUTONOMOUS MOBILE AUDIT: {args.url}")
            print("=" * 60)
            print(f"Verdict:              {res.get('verdict')}")
            metrics = res.get("metrics", {})
            print(f"Nav Clearance (Y>912): {metrics.get('nav_bar_clearance_px')}px")
            print(f"Execution Latency:    {metrics.get('duration_ms')}ms")
            evidence_b64 = res.get("evidence_b64")
            if evidence_b64:
                fn = f"evidence_{int(metrics.get('duration_ms', 0))}.png"
                with open(fn, "wb") as f:
                    f.write(base64.b64decode(evidence_b64))
                print(f"Visual Evidence:      {fn} ({len(evidence_b64):,} chars b64)")
            print("=" * 60)

    elif args.command == "flow":
        steps = [s.strip() for s in args.steps.split(",") if s.strip()]
        res = client.audit_flow(args.url, flow=steps)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print(f"✓ User journey executed: {res.get('steps_executed')}/{len(steps)} steps passed (Verdict: {res.get('verdict')})")

if __name__ == "__main__":
    main()
