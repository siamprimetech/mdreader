#!/usr/bin/env python3
"""Give the Android build the version code of the run that makes it.

Google Play takes a new build only when its version code is higher than the
one of the build before it, and it says so in one line: "Version code
1000000 has already been used". The code that the Tauri build makes on its own
is the same on every run, because it comes from the version of the app
(1.0.0 gives 1000000), so every build after the first one is refused.

The number of the run grows with every run of the workflow, so it is what the
code is made of: the code of a build is the number of the run that made it,
counted from a base that leaves room for a million runs. The base is the same
number the version of the app would give (1.0.0 gives 1000000), so a build
from the store and a build made on a desk do not land on the same code.

The code is written as a Tauri configuration that is merged into the
configuration of the project, and the build is run with it:

    python3 tools/android-version-code.py --run-number 22 --output code.json
    npx tauri android build --aab --config code.json

The automatic increment is turned off in that configuration. It reads the
code of the last build from a file in the generated project, and every run of
the workflow starts from the same file, so it would give the same code again.

Usage:
    python3 tools/android-version-code.py --run-number NUMBER [--output FILE]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

# The code of the first run of a workflow. The codes of the runs are counted
# from here, so that a code from the store and a code from a desk are in
# different families.
DEFAULT_BASE = 1_000_000

# The largest code Google Play takes.
PLAY_LIMIT = 2_100_000_000


def version_code(run_number: int, base: int) -> int:
    """Return the version code of the build of the run.

    The number of the run is added to the base, so every run has a code that
    is higher than the code of the run before it.
    """
    if run_number < 1:
        raise SystemExit(
            f"the number of the run is {run_number}, and it has to be a "
            "number of one or more."
        )
    if base < 1:
        raise SystemExit(
            f"the base is {base}, and it has to be a number of one or more."
        )

    code = base + run_number
    if code > PLAY_LIMIT:
        raise SystemExit(
            f"the version code would be {code}, and Google Play takes no code "
            f"that is above {PLAY_LIMIT}."
        )
    return code


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run-number",
        type=int,
        required=True,
        help="the number of the run of the workflow (github.run_number)",
    )
    parser.add_argument(
        "--base",
        type=int,
        default=DEFAULT_BASE,
        help=f"the number the codes are counted from (default: {DEFAULT_BASE})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="the file the Tauri configuration is written to",
    )
    args = parser.parse_args()

    code = version_code(args.run_number, args.base)
    print(f"the run is number {args.run_number}")
    print(f"the version code of the build is {code}")

    configuration = {
        "bundle": {
            "android": {
                "versionCode": code,
                "autoIncrementVersionCode": False,
            }
        }
    }

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(configuration, indent=2) + "\n")
        print(f"the configuration was written to {args.output}")


if __name__ == "__main__":
    main()
