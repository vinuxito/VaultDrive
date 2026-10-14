#!/usr/bin/env bash
# ==============================================================================
# FILEMÓN MODAL UI/UX — UNIVERSAL INSTALLER (install.sh)
# Copies the filemon-modal-uix skill into any target repository on this server.
# ==============================================================================

set -euo pipefail

SKILL_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_ROOT="${1:-}"

echo "======================================================================"
echo " FILEMÓN MODAL UI/UX — UNIVERSAL INSTALLER"
echo " Cinemascope Executive Modal & Sticky Tactical Dock"
echo "======================================================================"

if [ -z "$TARGET_ROOT" ]; then
    echo "❌ Error: Missing target directory."
    echo "Usage: $0 /lamp/www/<target_project>"
    echo "   or: $0 ."
    exit 1
fi

if [ ! -d "$TARGET_ROOT" ]; then
    echo "📁 Target directory does not exist. Creating: $TARGET_ROOT"
    mkdir -p "$TARGET_ROOT"
fi

TARGET_SKILL_DIR="$TARGET_ROOT/.agents/skills/filemon-modal-uix"
mkdir -p "$TARGET_SKILL_DIR"

echo "📦 Copying skill artifacts to: $TARGET_SKILL_DIR"
cp -v "$SKILL_SRC_DIR/SKILL.md" "$TARGET_SKILL_DIR/"
cp -v "$SKILL_SRC_DIR/template.html" "$TARGET_SKILL_DIR/"
cp -v "$SKILL_SRC_DIR/modal.css" "$TARGET_SKILL_DIR/"
cp -v "$SKILL_SRC_DIR/modal.js" "$TARGET_SKILL_DIR/"
cp -v "$SKILL_SRC_DIR/install.sh" "$TARGET_SKILL_DIR/"
chmod +x "$TARGET_SKILL_DIR/install.sh"

echo ""
echo "✅ Installation Complete! The skill is ready to use in: $TARGET_ROOT"
echo ""
echo "----------------------------------------------------------------------"
echo "QUICK INTEGRATION CHEATSHEET:"
echo "----------------------------------------------------------------------"
echo "1. In your HTML / PHP view:"
echo "   <link rel=\"stylesheet\" href=\"path/to/modal.css\">"
echo "   <!-- Paste template.html at bottom of <body> -->"
echo "   <script src=\"path/to/modal.js\"></script>"
echo ""
echo "2. In your app JavaScript:"
echo "   const modal = new FilemonModal();"
echo "   modal.open({"
echo "     type: 'PROPIEDAD',"
echo "     origin: '🏢 Torre Real',"
echo "     telemetry: 'Piso 4 • 120 m²',"
echo "     metric: '$4,850,000 MXN',"
echo "     timestamp: 'Hace 5 min',"
echo "     receipt: 'Folio #402 • 0 Delta',"
echo "     text: 'Descripción o datos de la propiedad...'"
echo "   }, {"
echo "     heroActionText: 'APARTAR AHORA',"
echo "     transmutations: ["
echo "       { id: 'pdf', label: '📄 Ficha PDF', handler: (item) => window.open('/pdf/' + item.id) },"
echo "       { id: 'wa',  label: '💬 WhatsApp', handler: (item) => window.open('https://wa.me/?text=' + encodeURIComponent(item.text)) }"
echo "     ],"
echo "     onHeroAction: async (item, text) => { console.log('Apartado:', item); },"
echo "     onDelete: async (item) => { console.log('Borrado:', item); }"
echo "   });"
echo "----------------------------------------------------------------------"
