#!/usr/bin/env python3
"""Write the entitlements of the macOS bundle.

A macOS app that goes to the App Store has to run inside the sandbox, and it
has to say which team and which app identifier it belongs to. Both are
written into the property list that is applied when the bundle is signed.

The team id is not in the repository: it belongs to the Apple account that
signs, so it is passed in. The script writes the file the bundler is told to
read, which is `src-tauri/Entitlements.plist`.

    python3 tools/macos-entitlements.py --team TEAMID --identifier com.example.app
"""

from __future__ import annotations

import argparse
import plistlib
import sys
from pathlib import Path

DEFAULT_OUTPUT = Path("src-tauri/Entitlements.plist")


def entitlements(team: str, identifier: str) -> dict:
    return {
        # The store only takes an app that runs inside the sandbox.
        "com.apple.security.app-sandbox": True,
        # The reader opens the files the user picks. The sandbox lets it read
        # and write exactly those, and nothing else.
        "com.apple.security.files.user-selected.read-write": True,
        # The reader asks GitHub whether a newer version has been published.
        "com.apple.security.network.client": True,
        # Apple matches the profile in the bundle against these two.
        "com.apple.application-identifier": f"{team}.{identifier}",
        "com.apple.developer.team-identifier": team,
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--team", required=True, help="the Apple team id")
    parser.add_argument("--identifier", required=True, help="the bundle identifier")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"where to write the property list (default: {DEFAULT_OUTPUT})",
    )
    args = parser.parse_args(argv[1:])

    if not args.team.strip():
        print("the team id is empty", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as handle:
        plistlib.dump(entitlements(args.team.strip(), args.identifier), handle)

    print(f"{args.output}: the entitlements of {args.identifier} for {args.team}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
