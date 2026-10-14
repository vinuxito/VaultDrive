#!/usr/bin/env bash
# ==============================================================================
# Experiencia de Barrio Nivel Dios — Universal Installer Script
# Installs or symlinks the skill into any target repository on this server or remote.
# ==============================================================================
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_PROJECT="${1:-}"

if [[ -z "$TARGET_PROJECT" ]]; then
    echo "Uso: $0 <directorio-del-proyecto> [--symlink|--copy]"
    echo "Ejemplo: $0 /lamp/www/quantix --symlink"
    exit 1
fi

MODE="${2:---symlink}"

if [[ ! -d "$TARGET_PROJECT" ]]; then
    echo "❌ Error: El directorio '$TARGET_PROJECT' no existe." >&2
    exit 1
fi

DEST_AGENTS="$TARGET_PROJECT/.agents/skills/experiencia-de-barrio-nivel-dios"
DEST_CLAUDE="$TARGET_PROJECT/.claude/skills/experiencia-de-barrio-nivel-dios"

mkdir -p "$TARGET_PROJECT/.agents/skills"
mkdir -p "$TARGET_PROJECT/.claude/skills"

if [[ "$MODE" == "--symlink" ]]; then
    echo "🔗 Enlazando simbólicamente skill hacia $TARGET_PROJECT..."
    rm -rf "$DEST_AGENTS" "$DEST_CLAUDE"
    ln -s "$SKILL_DIR" "$DEST_AGENTS"
    ln -s "$SKILL_DIR" "$DEST_CLAUDE"
else
    echo "📦 Copiando skill hacia $TARGET_PROJECT..."
    rm -rf "$DEST_AGENTS" "$DEST_CLAUDE"
    mkdir -p "$DEST_AGENTS" "$DEST_CLAUDE"
    cp -r "$SKILL_DIR"/* "$DEST_AGENTS"/
    cp -r "$SKILL_DIR"/* "$DEST_CLAUDE"/
fi

echo "✅ Experiencia de Barrio Nivel Dios instalada con éxito en: $TARGET_PROJECT"
echo "   - .agents/skills/experiencia-de-barrio-nivel-dios"
echo "   - .claude/skills/experiencia-de-barrio-nivel-dios"
echo ""
echo "🔥 Para usarla en cualquier agente de ese proyecto, agrégalo a tu AGENTS.md:"
echo "   > 'Aplica el skill experiencia-de-barrio-nivel-dios como filtro supremo de UI/UX y respeto al usuario.'"
