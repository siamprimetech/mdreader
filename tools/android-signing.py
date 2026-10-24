#!/usr/bin/env python3
"""Set up the signing of the Android build.

Google Play will not take a bundle that is not signed. The Android project
is made by "tauri android init" and it holds no signing configuration, so
the release build comes out unsigned and Play refuses it.

This writes the properties file Gradle reads (keystore.properties) and adds
the signing configuration to the build file of the application, the way the
Tauri guide describes it. The keystore itself is never written to the
repository: it is passed in as a file and it stays where it is.

The keystore is checked before anything is written, so a wrong password or a
wrong alias is reported in a second instead of after a build of several
minutes.

Usage:
    python3 tools/android-signing.py --keystore PATH --password PASSWORD \
        --alias ALIAS [--key-password PASSWORD]
"""

from __future__ import annotations

import argparse
import base64
import binascii
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT / "src-tauri" / "gen" / "android"
GRADLE = ANDROID / "app" / "build.gradle.kts"

SIGNING_CONFIG = """    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(FileInputStream(keystorePropertiesFile))
            }
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["password"] as String
            storeType = (keystoreProperties["storeType"] as String?) ?: "JKS"
        }
    }
"""

RELEASE_MARKER = 'getByName("release") {'
RELEASE_SIGNING = '            signingConfig = signingConfigs.getByName("release")\n'


def not_a_keystore(path: Path) -> str:
    """Explain what the file is, so the mistake can be found."""
    head = path.read_bytes()[:16]
    hexed = " ".join(f"{byte:02x}" for byte in head)
    lines = [
        f"that file does not look like a keystore: {path}",
        f"the first bytes are: {hexed}",
    ]
    if head.startswith(b"-----BEGIN"):
        lines.append(
            "It looks like a private key on its own (PEM). The secret has to "
            "hold the keystore file that keytool wrote, not the key inside it."
        )
    elif all(32 <= byte < 127 or byte in (9, 10, 13) for byte in head):
        lines.append(
            "It looks like text, not a keystore. The secret has to hold the "
            "base64 of the keystore file, and only once."
        )
    lines += [
        "A keystore written by keytool starts with feedfeed (a JKS one) or "
        "3082 (a PKCS12 one).",
        "To make the secret:",
        "    base64 -w0 upload-keystore.jks",
    ]
    return "\n".join(lines)


def looks_like_base64(path: Path) -> bool:
    """Tell whether the file holds base64 text rather than a keystore."""
    data = path.read_bytes()
    if len(data) < 32:
        return False
    stripped = bytes(byte for byte in data if byte not in b" \t\r\n")
    if len(stripped) % 4 != 0:
        return False
    try:
        base64.b64decode(stripped, validate=True)
    except (binascii.Error, ValueError):
        return False
    return True


def detect_store_type(path: Path, password: str, depth: int = 0) -> str:
    """Work out whether the file is a JKS or a PKCS12 keystore.

    A JKS file starts with the bytes feed feed, a PKCS12 file with an ASN.1
    sequence. Keytool on a current JDK writes PKCS12 unless it is told
    otherwise, so the two have to be told apart.
    """
    head = path.read_bytes()[:4]
    if head == b"\xfe\xed\xfe\xed":
        return "JKS"
    if head[:1] == b"\x30":
        return "PKCS12"

    # The secret sometimes holds the base64 of a base64, and the file is then
    # the text of the first one. Decoding it once more gives the keystore.
    if depth < 2 and looks_like_base64(path):
        data = path.read_bytes()
        stripped = bytes(byte for byte in data if byte not in b" \t\r\n")
        path.write_bytes(base64.b64decode(stripped))
        if depth == 0:
            print("the secret held the base64 more than once; it was decoded again")
        return detect_store_type(path, password, depth + 1)

    # Keytool knows every kind of keystore, so it is asked as well.
    result = keytool("-list", "-keystore", str(path), "-storepass", password)
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            if line.startswith("Keystore type:"):
                return line.split(":", 1)[1].strip()

    raise SystemExit(not_a_keystore(path))


def keytool(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["keytool", *arguments],
        capture_output=True,
        text=True,
        check=False,
    )


def check_store_password(path: Path, password: str) -> None:
    """Make sure the store password opens the keystore."""
    result = keytool("-list", "-keystore", str(path), "-storepass", password)
    if result.returncode == 0:
        return
    message = (result.stderr or result.stdout).strip()
    if "password was incorrect" in message or "tampered with" in message:
        raise SystemExit(
            "the store password is wrong. The keystore opens with the "
            "password it was created with; check ANDROID_KEYSTORE_PASSWORD."
        )
    if "Unrecognized keystore format" in message:
        raise SystemExit(not_a_keystore(path))
    raise SystemExit(f"the keystore could not be opened: {message}")


def check_alias(path: Path, password: str, alias: str) -> None:
    """Make sure the alias is in the keystore."""
    result = keytool(
        "-list", "-keystore", str(path), "-storepass", password, "-alias", alias
    )
    if result.returncode == 0:
        return
    raise SystemExit(
        f"the alias {alias} is not in the keystore. "
        "Run 'keytool -list -keystore <file> -storepass <password>' to see "
        "the aliases it holds, and check ANDROID_KEY_ALIAS."
    )


def key_opens(path: Path, password: str, alias: str, key_password: str) -> bool:
    """Tell whether the key password unlocks the private key.

    The key is read out of the keystore and written into a second keystore,
    which only works when the key password is the right one.
    """
    with tempfile.TemporaryDirectory() as folder:
        target = Path(folder) / "check.p12"
        result = keytool(
            "-importkeystore",
            "-srckeystore",
            str(path),
            "-srcstorepass",
            password,
            "-srcalias",
            alias,
            "-srckeypass",
            key_password,
            "-destkeystore",
            str(target),
            "-deststoretype",
            "PKCS12",
            "-deststorepass",
            "checking",
        )
        return result.returncode == 0


def check_key_password(
    path: Path, password: str, alias: str, key_password: str, store_type: str
) -> str:
    """Return the password that really opens the key.

    A PKCS12 keystore written by keytool protects the key with the store
    password and has no key password of its own, so the store password is
    used for the key as well.
    """
    if store_type == "PKCS12":
        if key_password != password:
            print(
                "the keystore is a PKCS12 one, so its key is protected by the "
                "store password; the store password is used for the key as well."
            )
        return password
    if key_opens(path, password, alias, key_password):
        return key_password
    raise SystemExit(
        "the key password does not open the key. It is the password the key "
        "was created with, and for a PKCS12 keystore it is the store "
        "password. Check ANDROID_KEY_PASSWORD."
    )


def write_properties(
    args: argparse.Namespace, store_type: str, key_password: str
) -> None:
    properties = [
        f"password={args.password}",
        f"keyAlias={args.alias}",
        f"keyPassword={key_password}",
        f"storeFile={args.keystore.resolve()}",
        f"storeType={store_type}",
    ]
    ANDROID.mkdir(parents=True, exist_ok=True)
    (ANDROID / "keystore.properties").write_text("\n".join(properties) + "\n")


def patch_gradle() -> None:
    if not GRADLE.exists():
        raise SystemExit(
            f"the Android project is not there: {GRADLE}. "
            "Run 'npx tauri android init' first."
        )

    text = GRADLE.read_text()
    if "signingConfigs" in text:
        if "storeType" not in text:
            text = text.replace(
                '            storePassword = keystoreProperties["password"] as String\n',
                '            storePassword = keystoreProperties["password"] as String\n'
                '            storeType = (keystoreProperties["storeType"] as String?) ?: "JKS"\n',
                1,
            )
            GRADLE.write_text(text)
            print("the build file was given the store type")
        else:
            print("the build file is already set up for signing")
        return

    if "import java.io.FileInputStream" not in text:
        text = text.replace(
            "import java.util.Properties",
            "import java.io.FileInputStream\nimport java.util.Properties",
            1,
        )

    marker = "    buildTypes {"
    if marker not in text:
        raise SystemExit("the build file has no buildTypes block")
    text = text.replace(marker, SIGNING_CONFIG + "\n" + marker, 1)

    if RELEASE_MARKER not in text:
        raise SystemExit("the build file has no release build type")
    text = text.replace(RELEASE_MARKER, RELEASE_MARKER + "\n" + RELEASE_SIGNING, 1)

    GRADLE.write_text(text)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keystore", type=Path, required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--alias", required=True)
    parser.add_argument("--key-password")
    args = parser.parse_args()

    if not args.keystore.exists():
        raise SystemExit(f"the keystore is not there: {args.keystore}")

    store_type = detect_store_type(args.keystore, args.password)
    print(f"the keystore is a {store_type} one")

    key_password = args.key_password or args.password

    if shutil.which("keytool"):
        check_store_password(args.keystore, args.password)
        check_alias(args.keystore, args.password, args.alias)
        key_password = check_key_password(
            args.keystore, args.password, args.alias, key_password, store_type
        )
    else:
        print("keytool is not there, so the keystore cannot be checked")

    write_properties(args, store_type, key_password)
    patch_gradle()
    print(f"the release build will be signed with {args.alias}")


if __name__ == "__main__":
    main()
