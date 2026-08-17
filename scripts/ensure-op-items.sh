#!/usr/bin/env bash
# Create the three Agents-vault items if they are missing.
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
  RESEND_API_KEY
  RESEND_EMAIL_DOMAIN
  KV_REST_API_URL
  KV_REST_API_TOKEN
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET_NAME
  R2_PUBLIC_BASE_URL
)

for title in \
  "askmeatsack.com Development" \
  "askmeatsack.com Preview" \
  "askmeatsack.com Production"; do
  if op item get "$title" --vault "$vault" >/dev/null 2>&1; then
    echo "exists ${title}" >&2
    continue
  fi

  op item create \
    --category "Secure Note" \
    --title "$title" \
    --vault "$vault" >/dev/null
  echo "created ${title} — add these field labels in 1Password, then pnpm env:vercel:" >&2
  for field in "${fields[@]}"; do
    echo "  ${field}" >&2
  done
done
