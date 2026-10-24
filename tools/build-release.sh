#!/usr/bin/env bash
# Builds distributable packages for the current platform.
#
# The result is a set of self-contained binaries: nothing beyond the operating
# system needs to be installed for the reader to run. There is no Node.js, no
# runtime and no package manager involved on the machine that receives them.
#
# The other platforms are built by the continuous integration; this is for
# producing the packages for the machine you are sitting at.
#
# Usage: tools/build-release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE="$ROOT/src-tauri/target/release/bundle"
RELEASES="$ROOT/release"

cd "$ROOT"

case "$(uname -s)" in
  Linux)
    BUNDLES="deb,appimage"
    PACKAGES=("*.deb" "*.AppImage")
    ;;
  Darwin)
    BUNDLES="dmg,app"
    PACKAGES=("*.dmg" "*.app.tar.gz")
    ;;
  MINGW* | MSYS* | CYGWIN*)
    BUNDLES="msi,nsis"
    PACKAGES=("*.msi" "*-setup.exe")
    ;;
  *)
    echo "no packages are known for this platform" >&2
    exit 1
    ;;
esac

echo "==> building the front end"
npm run build

echo "==> building the application"
cargo build --release --manifest-path src-tauri/Cargo.toml --features tauri/custom-protocol

echo "==> packaging ($BUNDLES)"
# The packages built here are not signed: signing needs the private key, which
# belongs in a secret rather than on a machine. The release workflow builds the
# signed packages.
#
# The updater artifacts are the exception: they are made when the private key
# is there, and they are the packages the reader updates itself with. Without
# the key they are left out, rather than asked for and refused.
CONFIG=()
if [ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  CONFIG=(--config '{"bundle":{"createUpdaterArtifacts":true}}')
fi
npm run tauri:build -- --bundles "$BUNDLES" ${CONFIG[@]+"${CONFIG[@]}"}

mkdir -p "$RELEASES"
rm -f "$RELEASES"/*
for pattern in "${PACKAGES[@]}"; do
  find "$BUNDLE" -maxdepth 2 -type f -name "$pattern" -exec cp -v {} "$RELEASES/" \;
done

echo
echo "packages are in $RELEASES:"
ls -lh "$RELEASES"
