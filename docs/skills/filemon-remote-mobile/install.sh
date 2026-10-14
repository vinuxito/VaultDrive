#!/usr/bin/env bash
# Filemón Remote Mobile Cloud — Autonomous Skill Installer
# Installs the filemon-remote-mobile skill and CLI on any outside machine or agent workspace.
set -e

REPO_BASE="https://android.filemonprime.net"
TARGET_DIR="${1:-$HOME/.agents/skills/filemon-remote-mobile}"

echo "============================================================"
echo "  FILEMÓN REMOTE MOBILE CLOUD — AGENT SKILL INSTALLER"
echo "  Target: android.filemonprime.net"
echo "============================================================"

echo "[*] Installing skill to: ${TARGET_DIR}..."
mkdir -p "${TARGET_DIR}/scripts" "${TARGET_DIR}/examples"

# Download core files
curl -sSL "${REPO_BASE}/skill/SKILL.md" -o "${TARGET_DIR}/SKILL.md" 2>/dev/null || true
curl -sSL "${REPO_BASE}/skill/scripts/filemon_mobile_client.py" -o "${TARGET_DIR}/scripts/filemon_mobile_client.py" 2>/dev/null || true
curl -sSL "${REPO_BASE}/skill/scripts/mcp_stdio_proxy.py" -o "${TARGET_DIR}/scripts/mcp_stdio_proxy.py" 2>/dev/null || true

chmod +x "${TARGET_DIR}/scripts/filemon_mobile_client.py" "${TARGET_DIR}/scripts/mcp_stdio_proxy.py" 2>/dev/null || true

# Symlink CLI to ~/.local/bin if available
if [ -d "$HOME/.local/bin" ]; then
    ln -sf "${TARGET_DIR}/scripts/filemon_mobile_client.py" "$HOME/.local/bin/filemon-remote-mobile"
    echo "[*] Symlinked CLI to $HOME/.local/bin/filemon-remote-mobile"
fi

echo "============================================================"
echo "  ✓ INSTALLATION COMPLETE"
echo "============================================================"
echo ""
echo "Next steps:"
echo "1. Set your authentication token:"
echo "   export FILEMON_MOBILE_TOKEN='YOUR_BEARER_TOKEN'"
echo ""
echo "2. Test the connection:"
echo "   ${TARGET_DIR}/scripts/filemon_mobile_client.py status"
echo ""
echo "3. For MCP Agents (Claude Code, Cursor, Windsurf, Antigravity):"
echo "   Configure your MCP client with command:"
echo "   python3 ${TARGET_DIR}/scripts/mcp_stdio_proxy.py"
echo "============================================================"
