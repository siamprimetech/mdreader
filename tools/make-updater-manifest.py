#!/usr/bin/env python3
"""Builds the update manifest the application checks for updates.

The updater asks a single URL for a manifest. This reads the packages that
were just built, pairs each with its signature, and writes the manifest the
application understands.

The manifest is keyed by target, and the target carries the kind of package
the reader was installed as, so a reader that installed the .deb is handed
the .deb and one that unpacked the AppImage is handed the AppImage.

Usage:
  tools/make-updater-manifest.py \
    --version 1.1.0 --tag v1.1.0 \
    --repository siamprimetech/mdreader \
    --directory packages --output latest.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

# The packages that can be installed over an existing installation, and the
# manifest key each belongs under. The architecture is filled in per file.
PACKAGE_SUFFIXES = {
    ".AppImage": "appimage",
    ".deb": "deb",
    ".rpm": "rpm",
    "-setup.exe": "nsis",
    ".msi": "msi",
}

# A compressed AppImage is the older shape of the same package; it is used
# only when the plain one is not there.
COMPRESSED_APPIMAGE = ".AppImage.tar.gz"

# The macOS package is a universal binary, so it answers for both.
MACOS_KEYS = ("darwin-aarch64-app", "darwin-x86_64-app")

# When a reader does not know how it was installed, it looks for the plain
# target. The package named here is the one that suits a reader which was
# simply run rather than installed.
DEFAULT_INSTALLER = {"linux": "appimage", "windows": "nsis", "darwin": "app"}

# How badly we would like to use a package, when several would do.
PREFERENCE = {".AppImage": 2, COMPRESSED_APPIMAGE: 1}


def architecture_of(name: str) -> str:
    """The architecture a package was built for, from its name."""
    lowered = name.lower()
    if "aarch64" in lowered or "arm64" in lowered:
        return "aarch64"
    if "armv7" in lowered or "arm" in lowered:
        return "armv7"
    if "i686" in lowered or "i386" in lowered:
        return "i686"
    return "x86_64"


def keys_for(name: str) -> list[str]:
    """The manifest keys a package answers for."""
    if name.endswith(".app.tar.gz"):
        return list(MACOS_KEYS)

    if name.endswith(COMPRESSED_APPIMAGE):
        return [f"linux-{architecture_of(name)}-appimage"]

    for suffix, kind in PACKAGE_SUFFIXES.items():
        if name.endswith(suffix):
            system = (
                "windows"
                if suffix.endswith(".exe") or suffix.endswith(".msi")
                else "linux"
            )
            return [f"{system}-{architecture_of(name)}-{kind}"]

    return []


def signature_for(package: Path) -> Path:
    """The signature that sits beside a package."""
    return package.with_name(package.name + ".sig")


def download_url(repository: str, tag: str, name: str, base_url: str | None) -> str:
    """Where the package can be fetched from once the release is published."""
    if base_url:
        return f"{base_url.rstrip('/')}/{tag}/{quote(name)}"
    return f"https://github.com/{repository}/releases/download/{tag}/{quote(name)}"


def collect(directory: Path) -> dict[str, tuple[Path, int]]:
    """The best package for each manifest key."""
    chosen: dict[str, tuple[Path, int]] = {}

    for package in sorted(directory.iterdir()):
        if not package.is_file():
            continue

        keys = keys_for(package.name)
        if not keys:
            continue

        if not signature_for(package).is_file():
            print(
                f"error: {package.name} has no signature beside it",
                file=sys.stderr,
            )
            raise SystemExit(1)

        rank = PREFERENCE.get(
            next((s for s in PREFERENCE if package.name.endswith(s)), ""), 0
        )

        for key in keys:
            existing = chosen.get(key)
            if existing is None or rank > existing[1]:
                chosen[key] = (package, rank)

    return chosen


def add_plain_targets(chosen: dict[str, tuple[Path, int]]) -> None:
    """Add the target a reader falls back to when it was not installed."""
    for key, (package, rank) in list(chosen.items()):
        parts = key.split("-")
        if len(parts) != 3:
            continue

        system, arch, installer = parts
        if installer != DEFAULT_INSTALLER.get(system):
            continue

        chosen[f"{system}-{arch}"] = (package, rank)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True, help="the version that was built")
    parser.add_argument("--tag", required=True, help="the release tag")
    parser.add_argument(
        "--repository", required=True, help="owner/name of the repository"
    )
    parser.add_argument("--directory", required=True, help="where the packages are")
    parser.add_argument("--output", required=True, help="where to write the manifest")
    parser.add_argument("--notes", default="", help="the release notes")
    parser.add_argument(
        "--base-url",
        default=None,
        help="where the packages are served from, instead of the GitHub release",
    )
    args = parser.parse_args()

    directory = Path(args.directory)
    if not directory.is_dir():
        print(f"error: {directory} is not a directory", file=sys.stderr)
        return 1

    chosen = collect(directory)
    add_plain_targets(chosen)
    if not chosen:
        print(f"error: no packages found in {directory}", file=sys.stderr)
        return 1

    platforms = {}
    for key, (package, _) in sorted(chosen.items()):
        signature = signature_for(package).read_text(encoding="utf-8").strip()
        platforms[key] = {
            "signature": signature,
            "url": download_url(
                args.repository, args.tag, package.name, args.base_url
            ),
        }
        print(f"  {key} -> {package.name}")

    manifest = {
        "version": args.version.lstrip("v"),
        "notes": args.notes,
        "pub_date": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "platforms": platforms,
    }

    Path(args.output).write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
