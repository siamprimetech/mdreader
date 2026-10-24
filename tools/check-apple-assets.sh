#!/usr/bin/env bash
# Says whether the files for a macOS build may go to the Mac App Store.
#
# The files are the same three that go into the secrets of the workflow:
#
#   bash tools/check-apple-assets.sh macos-signing.p12 macos-installer.p12 profile.mobileprovision
#
# The passwords are asked for, or given in the environment as
# APPLE_CERTIFICATE_PASSWORD and APPLE_INSTALLER_CERTIFICATE_PASSWORD.
#
# The rules are read from tools/apple-store-rules.sh, the file the workflow
# reads them from, so the answer here is the answer the run gives.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=tools/apple-store-rules.sh
source "$ROOT/tools/apple-store-rules.sh"

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <application.p12> <installer.p12> <profile.mobileprovision>" >&2
  exit 2
fi

application="$1"
installer="$2"
profile="$3"

read_password() {
  local prompt="$1"
  local given="$2"
  if [ -n "$given" ]; then
    printf '%s' "$given"
    return
  fi
  printf '%s' "$prompt" >&2
  read -r -s answer
  printf '\n' >&2
  printf '%s' "$answer"
}

# The name of the certificate inside a .p12 file. The subject is read with one
# attribute per line, because the name of an Apple certificate holds a comma
# of its own ("Siam Prime Tech Co., Ltd.") and the single line form cannot
# tell that comma from the one that ends an attribute.
common_name() {
  openssl pkcs12 -in "$1" -passin "pass:${2:-}" -nokeys -clcerts 2>/dev/null \
    | openssl x509 -noout -subject -nameopt sep_multiline 2>/dev/null \
    | sed -n 's/^[[:space:]]*CN=//p' \
    | head -1 || true
}

echo "== The certificate that signs the application"
if [ ! -f "$application" ]; then
  echo "   $application is not there."
  application_name=""
  application_ok="false"
else
  application_name="$(common_name "$application" \
    "$(read_password "password of $application: " "${APPLE_CERTIFICATE_PASSWORD:-}")")"
  echo "   name: ${application_name:-<the file could not be read>}"
  if is_distribution_name "$application_name"; then
    echo "   the store takes it: yes"
    application_ok="true"
  else
    echo "   the store takes it: no"
    echo "   the store wants an 'Apple Distribution' certificate (the Mac App Store also"
    echo "   calls it 'Mac App Distribution'; Apple's older name for the same one is"
    echo "   '3rd Party Mac Developer Application')."
    application_ok="false"
  fi
fi

echo ""
echo "== The certificate that signs the package"
if [ ! -f "$installer" ]; then
  echo "   $installer is not there."
  installer_ok="false"
else
  installer_name="$(common_name "$installer" \
    "$(read_password "password of $installer: " "${APPLE_INSTALLER_CERTIFICATE_PASSWORD:-}")")"
  echo "   name: ${installer_name:-<the file could not be read>}"
  if is_installer_name "$installer_name"; then
    echo "   the store takes it: yes"
    installer_ok="true"
  else
    echo "   the store takes it: no"
    echo "   the store wants a 'Mac Installer Distribution' certificate (Apple's older"
    echo "   name for the same one is '3rd Party Mac Developer Installer')."
    installer_ok="false"
  fi
fi

echo ""
echo "== The profile"
if [ ! -f "$profile" ]; then
  echo "   $profile is not there."
  profile_ok="false"
else
  details="$(profile_kind_file "$profile" 2>&1 >/dev/null || true)"
  kind="$(profile_kind_file "$profile" 2>/dev/null || echo unknown)"
  if [ -n "$details" ]; then
    while IFS= read -r line; do
      echo "   $line"
    done <<< "$details"
  fi
  case "$kind" in
    macos-store)
      echo "   the store takes it: yes"
      app_id="$(profile_app_id_file "$profile" || echo "")"
      if [ -n "$app_id" ] && [ "$app_id" != "com.siamprimetech.mdreader" ]; then
        echo "   but it belongs to the app '$app_id' and not to com.siamprimetech.mdreader."
        profile_ok="false"
      else
        profile_ok="true"
      fi
      ;;
    macos-other)
      echo "   the store takes it: no"
      echo "   it is a macOS profile of another kind: a development profile, or one"
      echo "   for programs that are sold outside the store. The store takes a"
      echo "   profile made in the portal with platform 'macOS' and type 'App Store'."
      profile_ok="false"
      ;;
    other)
      echo "   the store takes it: no"
      echo "   it is a profile for another platform. The Mac App Store wants one made"
      echo "   in the portal with platform 'macOS' and type 'App Store'."
      profile_ok="false"
      ;;
    *)
      echo "   the file could not be read."
      profile_ok="false"
      ;;
  esac

  if [ "$profile_ok" = "true" ]; then
    sandbox="$(profile_sandbox_file "$profile" 2>/dev/null || echo unknown)"
    echo "   sandbox: $sandbox"
    if [ "$sandbox" = "no" ]; then
      echo "   this is only a note. The app itself is signed with"
      echo "   com.apple.security.app-sandbox, because an app in the store runs"
      echo "   inside the sandbox, and a macOS profile in the portal does not list"
      echo "   that entitlement. The build is sent to the store anyway, and"
      echo "   Apple's validation of it has the last word."
    fi
  fi
fi

echo ""
if [ "$application_ok" = "true" ] && [ "$installer_ok" = "true" ] \
  && [ "$profile_ok" = "true" ]; then
  echo "The three files may go to the Mac App Store."
  exit 0
fi

echo "The macOS build would be kept as an artifact of the run and not sent to the store."
echo "What is missing is named above."
exit 1
