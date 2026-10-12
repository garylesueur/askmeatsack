#!/usr/bin/env bash
# Check existing Agents-vault items by stable identifier.
# Does not set values — fill those in 1Password, then pnpm env:vercel.
set -euo pipefail

vault="${OP_VAULT:-mep374l3cpdtzwibf5fswsimbi}"

if ! command -v op >/dev/null 2>&1; then
  echo "1Password CLI (op) is not on PATH." >&2
  exit 1
fi

if ! op whoami >/dev/null 2>&1; then
  echo "1Password CLI has no active session. Run 'op signin' in this terminal, then retry." >&2
  exit 1
fi

fields=(
  AGENT_API_KEY
  KV_REST_API_URL
  KV_REST_API_TOKEN
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME
  R2_PUBLIC_BASE_URL
)

for title in \
  "MEATSACK lanyard Development" \
  "ucxrz4yvhmmrajqqjdxokdmzju" \
  "fgps4a7gwmzfbl7vrn2lk6oela"; do
  if op item get "$title" --vault "$vault" >/dev/null 2>&1; then
    echo "exists ${title}" >&2
    continue
  fi

  echo "Required existing item ${title} was not found in vault ${vault}." >&2
  echo "Restore the saved item; do not create duplicate credentials." >&2
  exit 1

done
