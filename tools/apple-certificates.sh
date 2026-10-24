#!/usr/bin/env bash
# Imports the certificates of the Apple account into a keychain of their own.
#
# A macOS build that goes to the App Store needs three things from the
# account, and all three are set here:
#
#   APPLE_CERTIFICATE            the certificate that signs the application
#   APPLE_INSTALLER_CERTIFICATE  the certificate that signs the package
#   APPLE_PROVISIONING_PROFILE   the profile that belongs in the bundle
#
# The first two are .p12 files and the third is a .provisionprofile file, all
# of them in base64 in the repository settings. Nothing is missing on
# purpose: the reader keeps working without them, so a run without the
# secrets still builds the iOS app and says what is missing for macOS.
#
# The script writes what it found to the environment of the workflow:
#
#   APPLE_SIGNING_IDENTITY     the name of the signing identity
#   APPLE_INSTALLER_IDENTITY   the name of the installer certificate
#
# and two answers for the steps that follow:
#
#   signed=true|false           the application can be signed
#   distribution=true|false     the certificate is one the store takes
#   store_ready=true|false      the macOS build can go to the store
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The rules about what the store takes are in one file, so the workflow and
# the checker on a Linux machine cannot disagree about them.
# shellcheck source=tools/apple-store-rules.sh
source "$ROOT/tools/apple-store-rules.sh"
WORK="${RUNNER_TEMP:-/tmp}/apple-certificates"
KEYCHAIN_NAME="mdreader"
KEYCHAIN_PASSWORD="mdreader"
KEYCHAIN_PATH="${RUNNER_TEMP:-/tmp}/mdreader.keychain-db"

mkdir -p "$WORK"

note() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }

# Reads the base64 of a secret and writes the file it holds.
decode() {
  printf '%s' "$1" | tr -d ' \t\r\n' | base64 -d > "$2"
}

# The name of the certificate inside a .p12 file. It is the name the keychain
# shows, and the name that is given to codesign and to productbuild.
#
# The subject is read with one attribute per line, because the name of an
# Apple certificate holds a comma of its own ("Siam Prime Tech Co., Ltd.") and
# the single line form cannot tell that comma from the one that ends an
# attribute.
common_name() {
  openssl pkcs12 -in "$1" -passin "pass:${2:-}" -nokeys -clcerts 2>/dev/null \
    | openssl x509 -noout -subject -nameopt sep_multiline \
    | sed -n 's/^[[:space:]]*CN=//p' \
    | head -1
}

# The identities in the keychain that can sign code.
code_identities() {
  security find-identity -v -p codesigning "$KEYCHAIN_PATH" \
    | sed -n 's/.*"\(.*\)"/\1/p'
}

# The identity to sign the application with. The certificate that was handed
# over is the one to use; the distribution certificate is preferred over
# anything else that happens to be in the keychain.
signing_identity() {
  local preferred="${1:-}"
  local identities
  identities="$(code_identities | grep -v -i "installer" || true)"
  if [ -z "$identities" ]; then
    return 1
  fi
  if [ -n "$preferred" ]; then
    local match
    match="$(printf '%s\n' "$identities" | grep -F -- "$preferred" | head -1 || true)"
    if [ -n "$match" ]; then
      printf '%s\n' "$match"
      return 0
    fi
  fi
  local distribution
  distribution="$(printf '%s\n' "$identities" | grep -i "distribution" | head -1 || true)"
  if [ -n "$distribution" ]; then
    printf '%s\n' "$distribution"
    return 0
  fi
  printf '%s\n' "$identities" | head -1
}

# Puts a .p12 file into the keychain.
#
# The key is imported with -A: any tool of the runner may use it without
# being asked first. The other way is a list of the tools that may use it,
# and a tool that is not on that list asks for permission, and nobody is
# there to answer: the step waits forever with no output. That is what
# productbuild does when it signs the package, and it is why the package
# step once hung for hours. The keychain is made for this one run, it holds
# the key for the time of it, and the runner is thrown away afterwards.
import_certificate() {
  local file="$1"
  local password="${2:-}"

  if ! openssl pkcs12 -info -noout -in "$file" -passin "pass:$password" > /dev/null 2>&1; then
    warn "The password does not open the file in the secret."
    return 1
  fi

  if ! security import "$file" -k "$KEYCHAIN_PATH" -P "$password" -A; then
    note "macOS would not take the file as it is, so the certificate and the key"
    note "are taken out of it with openssl and imported one by one."
    openssl pkcs12 -in "$file" -passin "pass:$password" -nodes -out "$WORK/all.pem"
    awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' "$WORK/all.pem" > "$WORK/cert.pem"
    awk '/BEGIN PRIVATE KEY/,/END PRIVATE KEY/' "$WORK/all.pem" > "$WORK/key.pem"
    security import "$WORK/cert.pem" -k "$KEYCHAIN_PATH"
    security import "$WORK/key.pem" -k "$KEYCHAIN_PATH" -A
  fi

  # The key is only usable by codesign when the keychain allows it.
  security set-key-partition-list -S apple-tool:,apple:,codesign: \
    -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" > /dev/null
}

cd "$ROOT"

security delete-keychain "$KEYCHAIN_PATH" > /dev/null 2>&1 || true
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
# The search list holds this keychain and nothing else. The locked keychain
# of the runner is left out of it, because a tool that searches the list
# stops at a keychain it cannot open and asks for its password, and nobody
# is there to answer.
security list-keychain -d user -s "$KEYCHAIN_PATH"
note "The keychain $KEYCHAIN_NAME is open and unlocked."

signed="false"
installer="false"
profile="false"
distribution="false"

if [ -n "${APPLE_CERTIFICATE:-}" ]; then
  decode "$APPLE_CERTIFICATE" "$WORK/application.p12"
  note "The application certificate is $(wc -c < "$WORK/application.p12") bytes."
  if import_certificate "$WORK/application.p12" "${APPLE_CERTIFICATE_PASSWORD:-}"; then
    name="$(common_name "$WORK/application.p12" "${APPLE_CERTIFICATE_PASSWORD:-}")"
    if [ -z "$name" ]; then
      warn "The application certificate has no name to sign with."
    elif identity="$(signing_identity "$name")"; then
      echo "APPLE_SIGNING_IDENTITY=$identity" >> "${GITHUB_ENV:-/dev/null}"
      note "The application is signed with: $identity"
      signed="true"
      if is_distribution_name "$name"; then
        distribution="true"
      else
        warn "The certificate is named '$name'. The Mac App Store takes an"
        warn "'Apple Distribution' certificate (the Mac App Store also calls"
        warn "it 'Mac App Distribution', and Apple called it '3rd Party Mac"
        warn "Developer Application' before 2023) and nothing else, so the"
        warn "macOS build is kept as an artifact of the run and is not sent to"
        warn "the store."
      fi
    else
      warn "The certificate was imported, but no signing identity was found."
    fi
  fi
else
  warn "No application certificate is set."
fi

if [ -n "${APPLE_INSTALLER_CERTIFICATE:-}" ]; then
  decode "$APPLE_INSTALLER_CERTIFICATE" "$WORK/installer.p12"
  note "The installer certificate is $(wc -c < "$WORK/installer.p12") bytes."
  if import_certificate "$WORK/installer.p12" "${APPLE_INSTALLER_CERTIFICATE_PASSWORD:-}"; then
    name="$(common_name "$WORK/installer.p12" "${APPLE_INSTALLER_CERTIFICATE_PASSWORD:-}")"
    if [ -z "$name" ]; then
      warn "The installer certificate has no name to sign the package with."
    elif ! is_installer_name "$name"; then
      warn "The installer certificate is named '$name'. The store takes only a"
      warn "'Mac Installer Distribution' certificate (Apple called it '3rd Party"
      warn "Mac Developer Installer' before 2023), so the macOS package is not"
      warn "made and is not sent to the store."
    else
      echo "APPLE_INSTALLER_IDENTITY=$name" >> "${GITHUB_ENV:-/dev/null}"
      note "The package is signed with: $name"
      installer="true"
    fi
  fi
else
  warn "No installer certificate is set."
fi

if [ -n "${APPLE_PROVISIONING_PROFILE:-}" ]; then
  decode "$APPLE_PROVISIONING_PROFILE" "$ROOT/src-tauri/embedded.provisionprofile"
  note "The profile is $(wc -c < "$ROOT/src-tauri/embedded.provisionprofile") bytes."
  details="$(profile_kind_file "$ROOT/src-tauri/embedded.provisionprofile" 2>&1 >/dev/null || true)"
  kind="$(profile_kind_file "$ROOT/src-tauri/embedded.provisionprofile" 2>/dev/null || echo unknown)"
  if [ -n "$details" ]; then
    while IFS= read -r line; do
      note "the profile: $line"
    done <<< "$details"
  fi
  case "$kind" in
    macos-store)
      profile="true"
      ;;
    macos-other)
      warn "The profile is a macOS profile of another kind. The store takes only"
      warn "a Mac App Store profile, so the macOS build is not sent to the store."
      ;;
    other)
      warn "The profile is not for macOS. The macOS build needs a Mac App Store"
      warn "profile, and the iOS one is a separate file."
      ;;
    *)
      warn "The profile could not be read, so it is left out of the build."
      ;;
  esac

  if [ "$profile" = "true" ]; then
    app_id="$(profile_app_id_file "$ROOT/src-tauri/embedded.provisionprofile" || echo "")"
    if [ -n "$app_id" ] && [ "$app_id" != "com.siamprimetech.mdreader" ]; then
      warn "The profile belongs to the app '$app_id' and not to"
      warn "com.siamprimetech.mdreader, so it is left out of the build."
      profile="false"
    fi
  fi

  sandbox="$(profile_sandbox_file "$ROOT/src-tauri/embedded.provisionprofile" 2>/dev/null || echo unknown)"
  details="$details sandbox=$sandbox"
  if [ "$sandbox" = "no" ]; then
    warn "Note: the profile does not carry com.apple.security.app-sandbox. The"
    warn "app is signed with that entitlement, because an app in the store runs"
    warn "inside the sandbox, and a macOS profile in the portal does not list it."
    warn "This is only a note: the build is still sent to the store, and Apple's"
    warn "validation of the uploaded build has the last word."
  fi

  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    # The value goes on one line. The runner reads the file line by line,
    # and a value that is written with a line break in it ends the line
    # there, so the name of the value would be lost.
    write_output "profile_details" "$details"
  fi
else
  warn "No provisioning profile is set."
fi
store_ready="false"
if [ "$signed" = "true" ] && [ "$installer" = "true" ] \
  && [ "$profile" = "true" ] && [ "$distribution" = "true" ]; then
  store_ready="true"
  note "The macOS build may go to the App Store: the certificate that signs the"
  note "application, the certificate that signs the package and the profile are"
  note "all ones the store takes."
else
  warn "The macOS build cannot go to the App Store: it needs a 'Mac App"
  warn "Distribution' certificate, a 'Mac Installer Distribution' certificate"
  warn "and a Mac App Store profile for the App ID com.siamprimetech.mdreader."
  warn "The iOS build is not affected and is still uploaded."
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  write_output "signed" "$signed"
  write_output "installer" "$installer"
  write_output "profile" "$profile"
  write_output "distribution" "$distribution"
  write_output "store_ready" "$store_ready"
fi
