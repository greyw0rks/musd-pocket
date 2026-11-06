#!/usr/bin/env bash
# Compatibility entry point for the previous testing build.
set -euo pipefail
exec bash "$(dirname "$0")/build-app.sh"
