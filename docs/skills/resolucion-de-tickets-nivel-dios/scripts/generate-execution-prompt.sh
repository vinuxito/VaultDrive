#!/usr/bin/env bash
set -euo pipefail
if [[ $# -lt 1 || $# -gt 3 || "$1" == --* ]]; then
  echo 'Usage: generate-execution-prompt.sh <actual-index.md> [output.md] [--overwrite]' >&2
  exit 1
fi
skill_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -eq 1 ]]; then
  exec python3 "$skill_script_dir/prepare_execution.py" --index "$1" --stdout
fi
if [[ $# -eq 3 && "$3" != --overwrite ]]; then
  echo 'The optional third argument must be --overwrite after inspecting existing output.' >&2
  exit 1
fi
args=(--index "$1" --output "$2")
if [[ $# -eq 3 ]]; then args+=(--overwrite); fi
exec python3 "$skill_script_dir/prepare_execution.py" "${args[@]}"
