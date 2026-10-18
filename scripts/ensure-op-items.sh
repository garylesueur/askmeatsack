#!/usr/bin/env bash
# Compatibility entry point: inspect the existing central Development item.
# Never create duplicate per-product items or request personal-account sign-in.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$root/scripts/environment.mjs" check development
