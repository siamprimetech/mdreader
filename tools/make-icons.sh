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

if ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick is needed to take the transparency out of the iOS icons." >&2
  exit 1
fi

inkscape "$SOURCE" \
  --export-type=png \
  --export-width=1024 \
  --export-height=1024 \
  --export-filename="$ROOT/src-tauri/icons/source.png"

cd "$ROOT"

# The manifest holds the artwork of the layers of the Android icon: the
# background, the mark of the reader and the mark without a colour, for the
# phones that draw their launcher icons in the colours of their wallpaper.
npx tauri icon src-tauri/icons/app-icon.json

# The App Store takes an icon only when it has no channel of transparency, so
# the icons of the phone are laid on white and lose their alpha channel.
for icon in src-tauri/icons/ios/*.png; do
  convert "$icon" -background white -alpha remove -alpha off "$icon"
done

echo "icons regenerated"
