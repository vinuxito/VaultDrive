#!/usr/bin/env python3
"""
Filemón Mobile Cloud — MCP Stdio-to-HTTP Gateway
Bridges any local MCP client (Claude Code, Cursor, Windsurf, OpenCode)
to the remote MCP endpoint at https://android.filemonprime.net/mcp.
"""

import sys
import os
import json
import urllib.request
import urllib.error

ENDPOINT = os.environ.get("FILEMON_MOBILE_ENDPOINT", "https://android.filemonprime.net/mcp")
TOKEN = os.environ.get("FILEMON_MOBILE_TOKEN", "")

def resolve_token():
    global TOKEN
    if TOKEN:
        return
    token_file = os.path.expanduser("~/.filemon_mobile_token")
    if os.path.exists(token_file):
        with open(token_file, "r") as f:
            TOKEN = f.read().strip()

resolve_token()

def forward_rpc(payload: dict) -> dict:
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"

    req = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30.0) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {
            "jsonrpc": "2.0",
            "id": payload.get("id"),
            "error": {"code": -32000, "message": f"Remote MCP error HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')}"}
        }
    except Exception as e:
        return {
            "jsonrpc": "2.0",
            "id": payload.get("id"),
            "error": {"code": -32603, "message": f"Connection error: {str(e)}"}
        }

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req_data = json.loads(line)
            res_data = forward_rpc(req_data)
            sys.stdout.write(json.dumps(res_data) + "\n")
            sys.stdout.flush()
        except Exception as err:
            err_res = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {str(err)}"}
            }
            sys.stdout.write(json.dumps(err_res) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
