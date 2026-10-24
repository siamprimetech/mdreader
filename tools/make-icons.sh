#!/usr/bin/env bash
# Regenerates the application icons from the source artwork.
#
# Usage: tools/make-icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/src-tauri/icons/source.svg"

if ! command -v inkscape >/dev/null 2>&1; then
  echo "inkscape is needed to rasterise the icon artwork." >&2
  exit 1
fi

inkscape "$SOURCE" \
  --export-type=png \
  --export-width=1024 \
  --export-height=1024 \
  --export-filename="$ROOT/src-tauri/icons/source.png"

cd "$ROOT"
npx tauri icon src-tauri/icons/source.png

echo "icons regenerated"
