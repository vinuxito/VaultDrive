#!/bin/bash
# ABRN Drive - Auto-Reload Watch Script
# Monitors vaultdrive_client/dist for changes and auto-restarts backend

DIST_DIR="/lamp/www/ABRN-Drive/vaultdrive_client/dist"
SERVICE="abrndrive"

echo "═══════════════════════════════════════════════════════"
echo "  ABRN Drive Auto-Reload Watch Service"
echo "═══════════════════════════════════════════════════════"
echo "  Watching: $DIST_DIR"
echo "  Service:  $SERVICE"
echo "  Started:  $(date)"
echo "═══════════════════════════════════════════════════════"
echo ""

# Debounce mechanism - track last restart time
LAST_RESTART=0
DEBOUNCE_SECONDS=3

while true; do
    # Wait for file system events
    inotifywait -r -e modify,create,delete,move "$DIST_DIR" 2>/dev/null

    # Get current time
    NOW=$(date +%s)
    TIME_SINCE_LAST=$((NOW - LAST_RESTART))

    # Only restart if enough time has passed (debounce)
    if [ $TIME_SINCE_LAST -ge $DEBOUNCE_SECONDS ]; then
        echo ""
        echo "─────────────────────────────────────────────────────"
        echo "⚡ $(date '+%Y-%m-%d %H:%M:%S'): Frontend files changed!"
        echo "🔄 Restarting $SERVICE..."

        sudo systemctl restart "$SERVICE"

        if [ $? -eq 0 ]; then
            echo "✅ $SERVICE restarted successfully"
        else
            echo "❌ ERROR: Failed to restart $SERVICE"
        fi

        LAST_RESTART=$NOW
        echo "─────────────────────────────────────────────────────"
        echo ""
    fi

    # Small sleep to avoid CPU spinning
    sleep 1
done
