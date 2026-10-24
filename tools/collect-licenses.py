#!/usr/bin/env python3
"""Writes THIRD_PARTY_LICENSES.md from what the project actually depends on.

The reader bundles fonts and links a lot of Rust and JavaScript, all of it
under its own license. This collects the names, versions and license
identifiers from the package manifests, and copies the license texts from the
packages themselves rather than from memory.

Usage:
  tools/collect-licenses.py
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "THIRD_PARTY_LICENSES.md"
REGISTRY = ROOT / ".toolchain/cargo/registry/src"

# The license identifier each text is filed under, and where to find it.
TEXT_SOURCES: dict[str, list[str]] = {
    "MIT": [
        "node_modules/markdown-it/LICENSE",
        "node_modules/@tauri-apps/api/LICENSE-MIT",
    ],
    "Apache-2.0": [
        ".toolchain/cargo/registry/src/*/tauri-2.12.4/LICENSE-APACHE-2.0",
    ],
    "BSD-3-Clause": [
        "node_modules/highlight.js/LICENSE",
    ],
    "ISC": [
        ".toolchain/cargo/registry/src/*/untrusted-0.9.0/LICENSE.txt",
    ],
    "Zlib": [
        ".toolchain/cargo/registry/src/*/foldhash-0.2.0/LICENSE",
    ],
    "0BSD": [
        ".toolchain/cargo/registry/src/*/adler2-2.0.1/LICENSE-0BSD",
    ],
    "Unlicense": [
        ".toolchain/cargo/registry/src/*/same-file-1.0.6/UNLICENSE",
    ],
    "Unicode-3.0": [
        ".toolchain/cargo/registry/src/*/unicode-ident-1.0.27/LICENSE-UNICODE",
    ],
    "MPL-2.0": [
        ".toolchain/cargo/registry/src/*/option-ext-0.2.0/LICENSE.txt",
    ],
    "CDLA-Permissive-2.0": [
        ".toolchain/cargo/registry/src/*/webpki-root-certs-1.0.10/LICENSE",
    ],
    "SIL Open Font License 1.1": [
        "node_modules/@fontsource-variable/newsreader/LICENSE",
    ],
    "Apache-2.0 WITH LLVM-exception": [
        ".toolchain/cargo/registry/src/*/target-lexicon-0.12.16/LICENSE",
    ],
}

# The licenses that are only ever available as part of a dual license, and
# the one this project takes. Spelled out so the choice is on the record.
DUAL_LICENCE_CHOICE = {
    "MIT OR Apache-2.0": "MIT",
    "Apache-2.0 OR MIT": "MIT",
    "MIT/Apache-2.0": "MIT",
    "Apache-2.0/MIT": "MIT",
    "Apache-2.0 OR ISC OR MIT": "MIT",
    "MIT OR Apache-2.0 OR LGPL-2.1-or-later": "MIT",
    "MIT OR Apache-2.0 OR Zlib": "MIT",
    "MIT OR Zlib OR Apache-2.0": "MIT",
    "BSD-3-Clause OR MIT OR Apache-2.0": "MIT",
    "BSD-3-Clause/MIT": "MIT",
    "BSD-3-Clause OR MIT": "MIT",
    "Unlicense OR MIT": "MIT",
    "Unlicense/MIT": "MIT",
    "0BSD OR MIT OR Apache-2.0": "MIT",
    "Apache-2.0 OR ISC": "Apache-2.0",
    "Apache-2.0 AND MIT": "MIT",
    "Apache-2.0 AND ISC": "Apache-2.0",
    "BSD-3-Clause AND MIT": "BSD-3-Clause",
    "Zlib OR Apache-2.0 OR MIT": "Zlib",
    "CC0-1.0 OR MIT-0 OR Apache-2.0": "Apache-2.0",
    "(MIT OR Apache-2.0) AND Unicode-3.0": "MIT AND Unicode-3.0",
    "Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT": "Apache-2.0 WITH LLVM-exception",
}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def find_text(name: str) -> str | None:
    for pattern in TEXT_SOURCES.get(name, []):
        if "*" in pattern:
            matches = sorted(ROOT.glob(pattern))
            if matches:
                return read(matches[0])
        else:
            path = ROOT / pattern
            if path.is_file():
                return read(path)
    return None


def npm_licences() -> list[tuple[str, str, str]]:
    """The name, version and license of every direct JavaScript dependency."""
    package = json.loads(read(ROOT / "package.json"))
    entries: list[tuple[str, str, str]] = []

    for group in ("dependencies", "devDependencies"):
        for name, wanted in package.get(group, {}).items():
            manifest = ROOT / "node_modules" / name / "package.json"
            if not manifest.is_file():
                continue
            info = json.loads(read(manifest))
            license = info.get("license") or info.get("license") or "Unknown"
            if isinstance(license, list):
                license = " OR ".join(license)
            entries.append((name, info.get("version", wanted), str(license)))

    return sorted(entries)


def cargo_licences() -> list[tuple[str, str, str]]:
    """The name, version and license of every Rust crate in the lock file."""
    cargo = ROOT / ".toolchain/cargo/bin/cargo"
    command = [
        str(cargo) if cargo.is_file() else "cargo",
        "metadata",
        "--manifest-path",
        str(ROOT / "src-tauri/Cargo.toml"),
        "--format-version",
        "1",
    ]
    try:
        raw = subprocess.run(command, capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError) as error:
        print(
            f"warning: could not read the Rust dependencies: {error}", file=sys.stderr
        )
        return []

    metadata = json.loads(raw)
    entries = []
    for package in metadata["packages"]:
        source = package.get("source") or ""
        manifest = package.get("manifest_path") or ""
        if source.startswith("registry+"):
            entries.append(
                (
                    package["name"],
                    package["version"],
                    package.get("license") or "Unknown",
                )
            )
        elif manifest.startswith(str(ROOT / "vendor") + "/"):
            # A crate that is vendored in the repository, patched or not, is
            # still a crate the reader ships, so it is still listed.
            entries.append(
                (
                    package["name"],
                    package["version"],
                    package.get("license") or "Unknown",
                )
            )

    return sorted(entries)


# The names the typefaces are known by, which are not quite what their
# packages are called.
TYPEFACE_NAMES = {
    "ibm-plex-mono": "IBM Plex Mono",
    "ibm-plex-sans": "IBM Plex Sans",
    "jetbrains-mono": "JetBrains Mono",
    "literata": "Literata",
    "newsreader": "Newsreader",
    "public-sans": "Public Sans",
    "source-sans-3": "Source Sans 3",
    "source-serif-4": "Source Serif 4",
}


def font_copyrights() -> list[tuple[str, str]]:
    """The copyright line of every bundled typeface."""
    entries: list[tuple[str, str]] = []

    for path in sorted(ROOT.glob("node_modules/@fontsource*/**/LICENSE")):
        # node_modules/@fontsource-variable/newsreader/LICENSE
        scope, name = path.parts[-3], path.parts[-2]
        package = f"{scope}/{name}" if scope.startswith("@") else name

        # The typeface, without the packaging scope.
        typeface = TYPEFACE_NAMES.get(name, name)

        first = read(path).split("\n\n")[0].strip()
        # The first paragraph is the copyright, followed by the list of files.
        copyright_line = re.split(r"\s*\S+\.(?:ttf|otf|woff2?):", first)[0].strip()
        entries.append((typeface, copyright_line))

    return entries


# The identifiers the package manifests use, and the name each text is filed
# under.
RENAMED = {
    "OFL-1.1": "SIL Open Font License 1.1",
}


# The order the permissive licenses are preferred in, when a dependency offers
# a choice.
PREFERRED = ("MIT", "Apache-2.0", "ISC", "Zlib", "BSD-3-Clause", "Unlicense")


def chosen_licence(identifier: str) -> str:
    """The license this project takes when a dependency offers several."""
    identifier = identifier.replace("(", "").replace(")", "").strip()
    identifier = RENAMED.get(identifier, identifier)

    if identifier in DUAL_LICENCE_CHOICE:
        return DUAL_LICENCE_CHOICE[identifier]

    for separator in (" OR ", " / ", "/"):
        if separator in identifier:
            parts = [part.strip() for part in identifier.split(separator)]
            for preferred in PREFERRED:
                if preferred in parts:
                    return preferred
            return parts[0]

    if " AND " in identifier:
        return " AND ".join(chosen_licence(part) for part in identifier.split(" AND "))

    return identifier


def main() -> int:
    npm = npm_licences()
    cargo = cargo_licences()
    fonts = font_copyrights()

    licences_used = {chosen_licence(entry[2]) for entry in npm}
    licences_used |= {chosen_licence(entry[2]) for entry in cargo}
    licences_used.add("SIL Open Font License 1.1")

    lines: list[str] = []
    lines.append("# Third-party licenses")
    lines.append("")
    lines.append(
        "Simple MD Reader is distributed under the MIT license, which is in "
        "[LICENSE.md](LICENSE.md). It bundles and links the third-party "
        "software listed below, each under its own license. The full text of "
        "every license that applies is reproduced at the end of this file."
    )
    lines.append("")

    # -- the typefaces ---------------------------------------------------
    lines.append("## Bundled typefaces")
    lines.append("")
    lines.append(
        "The reader ships its own typefaces so that a document looks the same "
        "on every machine. All of them are licensed under the SIL Open Font "
        "License 1.1."
    )
    lines.append("")
    lines.append("| Typeface | Copyright |")
    lines.append("| --- | --- |")
    for name, copyright_line in fonts:
        lines.append(f"| {name} | {copyright_line} |")
    lines.append("")

    # -- javascript ------------------------------------------------------
    lines.append("## JavaScript dependencies")
    lines.append("")
    lines.append("| Package | Version | License |")
    lines.append("| --- | --- | --- |")
    for name, version, license in npm:
        lines.append(f"| {name} | {version} | {license} |")
    lines.append("")

    # -- rust ------------------------------------------------------------
    lines.append("## Rust dependencies")
    lines.append("")
    lines.append(
        "The reader is built with Tauri, and the table below covers every "
        "crate in the lock file."
    )
    lines.append("")
    lines.append("| Crate | Version | License |")
    lines.append("| --- | --- | --- |")
    for name, version, license in cargo:
        lines.append(f"| {name} | {version} | {license} |")
    lines.append("")

    # -- the texts -------------------------------------------------------
    lines.append("## License texts")
    lines.append("")

    for name in sorted(licences_used):
        parts = [part.strip() for part in name.split(" AND ")]
        text = "\n\n".join(filter(None, (find_text(part) for part in parts)))

        lines.append(f"### {name}")
        lines.append("")
        if text:
            lines.append(text.strip())
        else:
            lines.append(
                "The text of this license is not bundled here. It can be "
                "found at the address its package gives."
            )
        lines.append("")

    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)}")
    print(
        f"  {len(fonts)} typefaces, {len(npm)} javascript packages, {len(cargo)} rust crates"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
