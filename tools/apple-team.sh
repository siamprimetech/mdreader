#!/usr/bin/env bash
# Work out which Apple team signs the app, and put it in the environment.
#
# The team id is read from APPLE_DEVELOPMENT_TEAM, which the workflows take
# from the repository variable or from the repository secret of that name.
# For an individual Apple Developer account the issuer id of the key is the
# team id, so that is used when the setting is missing.
#
# The team id is printed on stdout, and written to GITHUB_ENV when the
# script runs in a workflow, so that the steps after it get it.

set -euo pipefail

team="${APPLE_DEVELOPMENT_TEAM:-}"
issuer="${APPLE_API_ISSUER:-}"

if [ -z "$team" ] && printf '%s' "$issuer" | grep -Eq '^[A-Z0-9]{10}$'; then
  team="$issuer"
fi

if [ -z "$team" ]; then
  echo "The Apple team id is missing." >&2
  echo "Set the repository variable or secret APPLE_DEVELOPMENT_TEAM to the" >&2
  echo "ten character team id of the Apple Developer account that signs the" >&2
  echo "app." >&2
  exit 1
fi

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "APPLE_DEVELOPMENT_TEAM=$team" >> "$GITHUB_ENV"
fi

echo "$team"
