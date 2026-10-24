# The rules that decide whether a macOS build may go to the Mac App Store.
#
# Both the workflow and the checker on a Linux machine read them from here, so
# the two cannot disagree about what the store takes.
#
#   is_distribution_name <name>   the certificate that signs the application
#   is_installer_name <name>      the certificate that signs the package
#   profile_kind_plist <plist>     the kind of a profile that was read
#   profile_kind_file <file>      the kind of a .mobileprovision
#   profile_sandbox_file <file>   whether the profile grants the sandbox
#
# The kinds of a profile are:
#
#   macos-store    a Mac App Store profile
#   macos-other    a macOS profile of another kind
#   other          a profile for another platform
#   unknown        the file could not be read

# Whether the name is the name of a certificate the Mac App Store takes for a
# macOS application.
#
# "Apple Distribution" is the certificate of today and it serves every
# platform: Apple's own words are "Distribute your iOS, iPadOS, macOS, tvOS,
# visionOS, watchOS app ... or submit it to App Store Connect". The Mac App
# Store also has its own name for it, "Mac App Distribution", and Apple called
# the same certificate "3rd Party Mac Developer Application" until 2023; an
# account that still holds the older one sees that name in its keychain.
#
# What the store does not take is a development certificate ("Apple
# Development", "3rd Party Mac Developer Application" is a distribution
# certificate, "Mac Development" is not) and the certificates for packages
# outside the store ("Developer ID Application").
is_distribution_name() {
  case "$1" in
    *"Mac App Distribution"*) return 0 ;;
    *"3rd Party Mac Developer Application"*) return 0 ;;
    *"Apple Distribution"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Whether the name is the name of the certificate that signs a package for the
# store. It is "Mac Installer Distribution" today and was "3rd Party Mac
# Developer Installer" before; the developer one ("Developer ID Installer")
# is for packages that are not sent to the store.
is_installer_name() {
  case "$1" in
    *"Mac Installer Distribution"*) return 0 ;;
    *"3rd Party Mac Developer Installer"*) return 0 ;;
    *) return 1 ;;
  esac
}

# The kind of a profile that has been read into a plist. What was found is
# written to the error output, so the file can be recognised without opening
# it.
profile_kind_plist() {
  python3 - "$1" <<'PY'
import plistlib
import sys

with open(sys.argv[1], "rb") as handle:
    profile = plistlib.load(handle)

platform = profile.get("Platform") or []
kind = profile.get("ProfileDistributionType") or ""
name = profile.get("Name") or ""
entitlements = profile.get("Entitlements") or {}

if isinstance(platform, str):
    platform = [platform]

# The store's profiles are called "APPSTORE" by Apple. Older files say
# "store" or "Mac App Store Connect", and the name of a profile in the
# portal says "Mac App Store", so all of them are read as the store.
store_types = {"APPSTORE", "STORE", "MACAPPSTORE", "MACAPPSTORECONNECT"}


def normalized(value):
    return "".join(ch for ch in str(value).upper() if ch.isalnum())


def is_macos(entry):
    # Apple writes the platform of a macOS profile as "OSX"; older files and
    # other tools write "OS X" or "macOS".
    return normalized(entry) in {"OSX", "MACOS", "MACOSX"}


# What tells the kinds of a macOS profile apart is in the file, and it is not
# the field "ProfileDistributionType": Apple writes that field only for the
# profiles of the other platforms. A macOS profile of the Mac App Store has
# no devices in it (a profile with devices is a development profile), it does
# not provision all devices (that is a Developer ID profile, for programs
# outside the store), and it does not allow debugging.
get_task_allow = entitlements.get("get-task-allow") is True
devices = profile.get("ProvisionedDevices")
all_devices = profile.get("ProvisionsAllDevices") is True
mac_app_store = entitlements.get("com.apple.developer.mac-app-store") is True
app_id = entitlements.get("com.apple.application-identifier") or ""

if any(is_macos(entry) for entry in platform):
    if get_task_allow or devices:
        # A development profile: it names the computers that may run the app.
        is_store = False
    elif all_devices:
        # A Developer ID profile: for programs that are not sent to the store.
        is_store = False
    else:
        # A distribution profile for macOS: the Mac App Store takes this one.
        is_store = True
    if normalized(kind) in store_types or mac_app_store:
        is_store = True
    print("macos-store" if is_store else "macos-other")
else:
    print("other")

print(f"name={name}", file=sys.stderr)
print(f"platform={', '.join(str(entry) for entry in platform)}", file=sys.stderr)
print(f"type={kind}", file=sys.stderr)
print(f"app-id={app_id}", file=sys.stderr)
print(f"entitlements={', '.join(sorted(str(key) for key in entitlements))}", file=sys.stderr)
print(f"mac-app-store={mac_app_store}", file=sys.stderr)
print(f"get-task-allow={get_task_allow}", file=sys.stderr)
print(f"provisioned-devices={len(devices) if devices else 0}", file=sys.stderr)
print(f"provisions-all-devices={all_devices}", file=sys.stderr)
PY
}

# Whether a file can be read as a plist.
_plist_readable() {
  python3 - "$1" << 'PY' > /dev/null 2>&1
import plistlib
import sys

with open(sys.argv[1], "rb") as handle:
    plistlib.load(handle)
PY
}

# Decodes a .mobileprovision into a plain plist and gives the path of it. The
# caller removes the file.
#
# On a Mac the file is read with "security cms", and everywhere else with
# openssl, which knows the same format. The result is checked by reading it,
# and whatever the tools say on their error output is kept: it is printed only
# when neither of them can read the file, so that a tool which complains while
# still doing its work does not hide the result.
_profile_plist() {
  local file="$1"
  local plist
  local error
  plist="$(mktemp "${TMPDIR:-/tmp}/apple-profile.XXXXXX")"
  error="$(mktemp "${TMPDIR:-/tmp}/apple-profile.XXXXXX")"

  if command -v security > /dev/null 2>&1 \
    && security cms -D -i "$file" > "$plist" 2> "$error" \
    && _plist_readable "$plist"; then
    rm -f "$error"
    printf '%s' "security cms" > "$plist.reader"
    printf '%s' "$plist"
    return 0
  fi

  local first
  first="$(cat "$error")"

  if openssl smime -verify -inform DER -in "$file" -noverify -out "$plist" \
    > /dev/null 2> "$error" && _plist_readable "$plist"; then
    rm -f "$error"
    printf '%s' "openssl" > "$plist.reader"
    printf '%s' "$plist"
    return 0
  fi

  local second
  second="$(cat "$error")"
  rm -f "$error"
  printf '%s\n%s\n' "$first" "$second" >&2
  rm -f "$plist"
  return 1
}

# The kind of a .mobileprovision. The file is a signed plist: on a Mac it is
# read with "security cms", and everywhere else with openssl, which knows the
# same format.
profile_kind_file() {
  local file="$1"
  local plist

  if ! plist="$(_profile_plist "$file")"; then
    echo "unknown"
    return
  fi

  if [ -f "$plist.reader" ]; then
    printf 'reader=%s\n' "$(cat "$plist.reader")" >&2
    rm -f "$plist.reader"
  fi

  profile_kind_plist "$plist"
  local status=$?
  rm -f "$plist"
  return $status
}

# Whether a profile carries the sandbox entitlement.
#
# A macOS app that goes to the App Store runs inside the sandbox, so the app is
# signed with com.apple.security.app-sandbox. The portal does not offer an "App
# Sandbox" capability for a universal App ID, and a macOS profile therefore does
# not list that entitlement. So this is only a note: it says what the profile
# holds, it does not decide whether the build may go to the store.
profile_sandbox_file() {
  local file="$1"
  local plist
  plist="$(_profile_plist "$file")" || { echo "unknown"; return 1; }
  python3 - "$plist" << 'PY'
import plistlib
import sys

with open(sys.argv[1], "rb") as handle:
    profile = plistlib.load(handle)

entitlements = profile.get("Entitlements") or {}
print("yes" if entitlements.get("com.apple.security.app-sandbox") is True else "no")
PY
  local status=$?
  rm -f "$plist"
  return $status
}

# The app identifier a profile belongs to, without the team in front of it.
# A profile for another app is of no use to this app, so it is worth asking.
profile_app_id_file() {
  local file="$1"
  local plist

  if ! plist="$(_profile_plist "$file")"; then
    return 1
  fi

  python3 - "$plist" << 'PY'
import plistlib
import sys

with open(sys.argv[1], "rb") as handle:
    profile = plistlib.load(handle)

entitlements = profile.get("Entitlements") or {}
identifier = entitlements.get("com.apple.application-identifier") or ""
print(identifier.split(".", 1)[1] if "." in identifier else identifier)
PY
  local status=$?
  rm -f "$plist"
  return $status
}

# Writes a value to the output of the workflow step.
#
# The runner reads that file line by line, and a value is "name=value" on one
# line. A value that holds a line break would end the line there, and the
# name of the value would be lost; a value that is written with a heredoc
# needs a line that is exactly the name of the delimiter, and one that is
# missing makes the whole step fail. So the value is put on one line, with
# the line breaks turned into spaces.
write_output() {
  local name="$1"
  local value="$2"

  [ -n "${GITHUB_OUTPUT:-}" ] || return 0

  value="$(printf '%s\n' "$value" | tr '\n' ' ' | sed 's/  */ /g; s/  *$//')"
  printf '%s=%s\n' "$name" "$value" >> "$GITHUB_OUTPUT"
}
