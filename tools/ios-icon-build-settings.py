#!/usr/bin/env python3
"""Tell Xcode to put the app icons in the bundle as plain pictures.

App Store Connect looks through the bundle for the icons it expects and
does not find them inside an asset catalog, so a build can be refused with

    The bundle does not contain an app icon for iPad of exactly '152x152'
    pixels, in .png format for iOS versions >= 10.0

even though the catalog holds them. The setting that fixes it is

    ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES

which tells the asset compiler to write every app icon out as a loose
picture in the bundle as well.

The Xcode project is generated, so the setting is written into it every
time the project is prepared. The script is idempotent: it changes
nothing when the setting is already there, and it warns rather than
fails when the project does not look the way it expects.

    python3 tools/ios-icon-build-settings.py [path to a project file]
"""

from __future__ import annotations

import sys
from pathlib import Path

SETTING = "ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS"
ANCHOR = "ASSETCATALOG_COMPILER_APPICON_NAME"

DEFAULT_PROJECT = Path("src-tauri/gen/apple/tauri-iOS.xcodeproj/project.pbxproj")


def project_file(argument: str | None) -> Path:
    if argument:
        return Path(argument)
    if DEFAULT_PROJECT.is_file():
        return DEFAULT_PROJECT
    # The name of the project is not fixed, so look for the one that is there.
    for found in sorted(
        Path("src-tauri/gen/apple").glob("*.xcodeproj/project.pbxproj")
    ):
        return found
    return DEFAULT_PROJECT


def add_setting(text: str) -> tuple[str, bool]:
    if SETTING in text:
        return text, False

    marker = f"{SETTING} = YES;"
    index = text.find(ANCHOR)
    if index == -1:
        return text, False

    # Put the setting next to the app icon name, which is in the same
    # dictionary of build settings.
    end = text.find(";", index)
    if end == -1:
        return text, False
    end += 1
    return text[:end] + f"\n\t\t\t\t{SETTING} = YES;" + text[end:], True


def main() -> int:
    path = project_file(sys.argv[1] if len(sys.argv) > 1 else None)

    if not path.is_file():
        print(f"The Xcode project is not there: {path}", file=sys.stderr)
        print("Run 'npx tauri ios init' first.", file=sys.stderr)
        return 1

    text = path.read_text(encoding="utf-8")
    new_text, changed = add_setting(text)

    if changed:
        path.write_text(new_text, encoding="utf-8")
        print(f"Wrote {SETTING} into {path}")
    elif SETTING in text:
        print(f"{path} already has {SETTING}")
    else:
        print(
            f"Warning: {path} has no {ANCHOR}, so {SETTING} was not written.",
            file=sys.stderr,
        )
        print(
            "The icons are in the catalog either way, but App Store Connect "
            "may not find them in the bundle.",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
