#!/usr/bin/env python3
"""Put the icon of the reader into the generated Android project.

The Android project is made by `tauri android init`, and the project that
comes out of it carries the icon of Tauri itself: the launcher of the phone
shows the logo of the tool that built the app. The icon of the reader is kept
in `src-tauri/icons/android`, and this script copies it into the project, so
that the phone shows the reader.

The script is run after the project is made, and again before every build,
because `tauri android init` puts the icon of Tauri back when it runs.

Usage:
    python3 tools/android-app-icon.py [--project DIR] [--icons DIR]
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

# Where the generated Android project keeps its drawings.
DEFAULT_PROJECT = Path("src-tauri/gen/android/app/src/main/res")

# Where the icon of the reader is kept.
DEFAULT_ICONS = Path("src-tauri/icons/android")

# The drawings of Tauri that the generated project carries. They are of no use
# once the icon of the reader is in place.
TAURI_DRAWINGS = (
    Path("drawable/ic_launcher_background.xml"),
    Path("drawable-v24/ic_launcher_foreground.xml"),
)

# The icon of the reader, written out for the phone in the shape it draws the
# launcher icon in. The round icon is the same icon, because a phone that
# asks for a round icon is asking for the same picture.
ADAPTIVE_ICON = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <background android:drawable="@mipmap/ic_launcher_background"/>
  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
"""


def copy_icons(icons: Path, project: Path) -> list[Path]:
    """Copy the icon of the reader into the project and return the files."""
    written: list[Path] = []

    for folder in sorted(icons.glob("mipmap-*")):
        if not folder.is_dir():
            continue
        for source in sorted(folder.rglob("*")):
            if not source.is_file():
                continue
            target = project / source.relative_to(icons)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            written.append(target)

    return written


def write_adaptive_icon(project: Path) -> list[Path]:
    """Write the icon of the reader for the shapes a phone draws."""
    folder = project / "mipmap-anydpi-v26"
    folder.mkdir(parents=True, exist_ok=True)

    written = []
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        target = folder / name
        target.write_text(ADAPTIVE_ICON)
        written.append(target)

    return written


def is_referenced(project: Path, name: str) -> bool:
    """Say whether any drawing of the project points at the given name."""
    for path in project.rglob("*.xml"):
        if f"@drawable/{name}" in path.read_text(encoding="utf-8"):
            return True
    return False


def remove_tauri_drawings(project: Path) -> list[Path]:
    """Take the drawings of Tauri away, when nothing points at them."""
    removed: list[Path] = []

    for drawing in TAURI_DRAWINGS:
        if is_referenced(project, drawing.stem):
            continue
        target = project / drawing
        if not target.exists():
            continue
        target.unlink()
        removed.append(target)

    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--project",
        type=Path,
        default=DEFAULT_PROJECT,
        help=f"the drawings of the generated project (default: {DEFAULT_PROJECT})",
    )
    parser.add_argument(
        "--icons",
        type=Path,
        default=DEFAULT_ICONS,
        help=f"the icon of the reader (default: {DEFAULT_ICONS})",
    )
    args = parser.parse_args()

    if not args.project.is_dir():
        raise SystemExit(
            f"there is no project in {args.project}. The Android project is "
            "made by `npx tauri android init`."
        )
    if not args.icons.is_dir():
        raise SystemExit(f"there are no icons in {args.icons}.")

    written = copy_icons(args.icons, args.project)
    written += write_adaptive_icon(args.project)

    removed = remove_tauri_drawings(args.project)

    print(f"{len(written)} files of the icon were written to {args.project}")
    for path in written:
        print(f"  {path}")
    if removed:
        print("the drawings of Tauri were taken away:")
        for path in removed:
            print(f"  {path}")


if __name__ == "__main__":
    main()
