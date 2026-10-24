#!/usr/bin/env python3
"""Write the reader's own icon into an iOS icon set.

`tauri ios init` writes the iOS project with the icon that ships with the
tool, so the build that goes to Apple carries the wrong picture. This writes
the reader's icon into an icon set instead.

Apple wants the icon without transparency, so the picture is flattened onto
its own background before it is written.

The set that goes with the repository lives in `src-tauri/icons/ios`, and the
continuous integration copies it into the generated project, so this tool is
only needed when the picture itself changes:

    python3 tools/ios-app-icon.py src-tauri/icons/ios

Run without an argument it writes into the icon set of the generated project,
which has to exist:

    python3 tools/ios-app-icon.py

It needs Pillow.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SET = (
    ROOT / "src-tauri" / "gen" / "apple" / "Assets.xcassets" / "AppIcon.appiconset"
)
SOURCE = ROOT / "src-tauri" / "icons" / "source.png"

# The pictures that go into the set: the file name and the size in pixels.
#
# The iPad needs sizes of its own, so the set holds the iPad Pro icon
# (167x167) and the iPad icon at twice its size (76x76 at 2x = 152 pixels),
# which App Store Connect asks for by name.
FILES = [
    ("AppIcon-20x20@1x.png", 20),
    ("AppIcon-20x20@2x.png", 40),
    ("AppIcon-20x20@3x.png", 60),
    ("AppIcon-29x29@1x.png", 29),
    ("AppIcon-29x29@2x.png", 58),
    ("AppIcon-29x29@3x.png", 87),
    ("AppIcon-40x40@1x.png", 40),
    ("AppIcon-40x40@2x.png", 80),
    ("AppIcon-40x40@3x.png", 120),
    ("AppIcon-60x60@2x.png", 120),
    ("AppIcon-60x60@3x.png", 180),
    ("AppIcon-76x76@1x.png", 76),
    ("AppIcon-76x76@2x.png", 152),
    ("AppIcon-83.5x83.5@2x.png", 167),
    ("AppIcon-167x167@1x.png", 167),
    ("AppIcon-167x167@2x.png", 334),
    ("AppIcon-512@2x.png", 1024),
]

# The entries Contents.json needs: the file, the device, the scale and the
# size as the device asks for it. One file can serve two devices.
ENTRIES = [
    ("AppIcon-20x20@1x.png", "iphone", "1x", "20x20"),
    ("AppIcon-20x20@2x.png", "iphone", "2x", "20x20"),
    ("AppIcon-20x20@3x.png", "iphone", "3x", "20x20"),
    ("AppIcon-20x20@1x.png", "ipad", "1x", "20x20"),
    ("AppIcon-20x20@2x.png", "ipad", "2x", "20x20"),
    ("AppIcon-29x29@1x.png", "iphone", "1x", "29x29"),
    ("AppIcon-29x29@2x.png", "iphone", "2x", "29x29"),
    ("AppIcon-29x29@3x.png", "iphone", "3x", "29x29"),
    ("AppIcon-29x29@1x.png", "ipad", "1x", "29x29"),
    ("AppIcon-29x29@2x.png", "ipad", "2x", "29x29"),
    ("AppIcon-40x40@1x.png", "iphone", "1x", "40x40"),
    ("AppIcon-40x40@2x.png", "iphone", "2x", "40x40"),
    ("AppIcon-40x40@3x.png", "iphone", "3x", "40x40"),
    ("AppIcon-40x40@1x.png", "ipad", "1x", "40x40"),
    ("AppIcon-40x40@2x.png", "ipad", "2x", "40x40"),
    ("AppIcon-60x60@2x.png", "iphone", "2x", "60x60"),
    ("AppIcon-60x60@3x.png", "iphone", "3x", "60x60"),
    ("AppIcon-76x76@1x.png", "ipad", "1x", "76x76"),
    ("AppIcon-76x76@2x.png", "ipad", "2x", "76x76"),
    ("AppIcon-83.5x83.5@2x.png", "ipad", "2x", "83.5x83.5"),
    ("AppIcon-167x167@1x.png", "ipad", "1x", "167x167"),
    ("AppIcon-167x167@2x.png", "ipad", "2x", "167x167"),
    ("AppIcon-512@2x.png", "ios-marketing", "1x", "1024x1024"),
]


def flatten(image: Image.Image) -> Image.Image:
    """Drop the alpha channel, onto the color the picture already has."""
    rgba = image.convert("RGBA")
    background = rgba.getpixel((0, 0))[:3]
    canvas = Image.new("RGB", rgba.size, background)
    canvas.paste(rgba, (0, 0), rgba.getchannel("A"))
    return canvas


def find_set(target: Path) -> Path:
    """The icon set of the generated project, wherever it was put."""
    if target.exists():
        return target
    root = ROOT / "src-tauri" / "gen" / "apple"
    found = sorted(root.glob("**/*.appiconset"))
    if found:
        return found[0]
    return target


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SET
    target = find_set(target)
    if not target.exists():
        print(
            f"The icon folder {target} is not there. Run `npx tauri ios init` first.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    if not SOURCE.exists():
        print(f"The icon {SOURCE} is missing.", file=sys.stderr)
        raise SystemExit(1)

    source = flatten(Image.open(SOURCE))
    images = []
    wanted = {name for name, _ in FILES}
    for old in target.glob("*.png"):
        if old.name not in wanted:
            old.unlink()
    for name, pixels in FILES:
        picture = source.resize((pixels, pixels), Image.LANCZOS)
        picture.save(target / name, format="PNG")

    for name, idiom, scale, size in ENTRIES:
        images.append(
            {
                "filename": name,
                "idiom": idiom,
                "scale": scale,
                "size": size,
            }
        )

    (target / "Contents.json").write_text(
        json.dumps(
            {"images": images, "info": {"author": "xcode", "version": 1}}, indent=2
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(images)} icons into {target}.")


if __name__ == "__main__":
    main()
