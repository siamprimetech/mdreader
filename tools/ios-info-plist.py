#!/usr/bin/env python3
"""Say in the iOS bundle whether the reader opens documents in place.

Xcode complains when an application declares document types but does not
say what it does with them:

    warning: The application supports opening files, but doesn't declare
    whether it supports opening them in place.

The answer is no. The reader never writes to the file it opens, so the
system copies the document into the sandbox and the original stays where
the user left it. Answering yes would hand the application a document it
can only read through a security scoped resource, and the reader does not
open one.

The Xcode project is generated, so the answer is written into the
generated property list every time the project is prepared. The script
is idempotent: it changes nothing when the answer is already there.

    python3 tools/ios-info-plist.py [path to a property list or a folder]
"""

from __future__ import annotations

import plistlib
import sys
from pathlib import Path

KEY = "LSSupportsOpeningDocumentsInPlace"


def property_lists(root: Path) -> list[Path]:
    if root.is_file():
        return [root]

    found: list[Path] = []
    for path in sorted(root.glob("*/Info.plist")):
        # The build folder holds copies that are made during the build.
        if "build" in path.parts:
            continue
        found.append(path)

    return found


def main(argv: list[str]) -> int:
    root = Path(argv[1]) if len(argv) > 1 else Path("src-tauri/gen/apple")
    lists = property_lists(root)

    if not lists:
        print(f"no property list found under {root}", file=sys.stderr)
        return 1

    for path in lists:
        with path.open("rb") as handle:
            content = plistlib.load(handle)

        if KEY in content:
            print(f"{path}: {KEY} already says {content[KEY]}")
            continue

        content[KEY] = False
        with path.open("wb") as handle:
            plistlib.dump(content, handle)

        print(f"{path}: {KEY} set to false")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
