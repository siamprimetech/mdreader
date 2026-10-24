#!/usr/bin/env bash
# Puts the headers of the node of the SDK where node-gyp looks for them.
#
# The generator of the npm sources calls this script. It looks for the headers
# of the node that is running, and the SDK keeps them next to the binary.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

version="$(node --version | sed 's/^v//')"
nodedir="$(dirname "$(dirname "$(which node)")")"

mkdir -p "$here/cache/node-gyp/$version"
ln -sfn "$nodedir/include" "$here/cache/node-gyp/$version/include"
echo 11 > "$here/cache/node-gyp/$version/installVersion"
