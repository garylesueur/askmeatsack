#!/usr/bin/env bash
# Push 1Password-backed templates to Vercel Preview and Production.
# Same idea as calm-app/devops/vercel-secrets-sync.sh: templates are the
# source of truth; op:// lines become sensitive vars; literals do not.
# Development stays in 1Password and is loaded with pnpm env / pnpm dev:op.
#
# Usage: pnpm env:vercel [preview|production|all] [--only-new] [--var NAME] [--env preview|production|all]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

ONLY_NEW=false
SINGLE_VAR=""
ENV_FILTER=""
POSITIONAL=""

usage() {
  echo "Usage: pnpm env:vercel [preview|production|all] [--only-new] [--var NAME] [--env preview|production|all]" >&2
  echo "Development stays in 1Password and is loaded with pnpm env / pnpm dev:op." >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --only-new)
      ONLY_NEW=true
      shift
      ;;
    --var)
      if [ -z "${2:-}" ]; then
        echo "Error: --var requires a name" >&2
        usage
      fi
      SINGLE_VAR="$2"
      shift 2
      ;;
    --env)
      if [ -z "${2:-}" ]; then
        echo "Error: --env requires preview, production, or all" >&2
        usage
      fi
      case "$2" in
        preview|production|all) ENV_FILTER="$2" ;;
        *)
          echo "Error: --env must be preview, production, or all (got: $2)" >&2
          usage
          ;;
      esac
      shift 2
      ;;
    preview|production|all)
      if [ -n "$POSITIONAL" ]; then
        echo "Error: more than one environment argument" >&2
        usage
      fi
      POSITIONAL="$1"
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage
      ;;
  esac
done

if [ -n "$ENV_FILTER" ] && [ -n "$POSITIONAL" ] && [ "$ENV_FILTER" != "$POSITIONAL" ]; then
  echo "Error: --env ${ENV_FILTER} conflicts with ${POSITIONAL}" >&2
  exit 1
fi

if [ -z "$ENV_FILTER" ]; then
  ENV_FILTER="${POSITIONAL:-all}"
fi

PREVIEW_TEMPLATE=".env.preview.tpl"
PRODUCTION_TEMPLATE=".env.production.tpl"
OP_VAULT_DEFAULT="mep374l3cpdtzwibf5fswsimbi"
vault="${OP_VAULT:-$OP_VAULT_DEFAULT}"

if { [ "$ENV_FILTER" = "all" ] || [ "$ENV_FILTER" = "preview" ]; } && [ ! -f "$PREVIEW_TEMPLATE" ]; then
  echo "Error: Preview template '$PREVIEW_TEMPLATE' not found in $root" >&2
  exit 1
fi

if { [ "$ENV_FILTER" = "all" ] || [ "$ENV_FILTER" = "production" ]; } && [ ! -f "$PRODUCTION_TEMPLATE" ]; then
  echo "Error: Production template '$PRODUCTION_TEMPLATE' not found in $root" >&2
  exit 1
fi

if ! command -v op >/dev/null 2>&1; then
  echo "1Password CLI (op) is not on PATH." >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is not on PATH." >&2
  exit 1
fi

# `op account list` succeeds without a session. Item reads need `op whoami`.
if ! op whoami >/dev/null 2>&1; then
  echo "1Password CLI has no active session. Run 'op signin' in this terminal, then retry." >&2
  exit 1
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "Please log in to Vercel CLI first with 'vercel login'." >&2
  exit 1
fi

if [ ! -d ".vercel" ]; then
  echo "This directory is not linked to a Vercel project. Run 'vercel link' first." >&2
  exit 1
fi

# macOS Bash 3.2 + set -u treats an empty array as unbound. Never expand
# optional flags as "${arr[@]}"; append them only when present.
run_vercel() {
  if [ -n "${VERCEL_SCOPE:-}" ]; then
    vercel "$@" --scope="$VERCEL_SCOPE"
  else
    vercel "$@"
  fi
}

expand_op_ref() {
  local value="$1"
  value="${value//\$\{OP_VAULT:-$OP_VAULT_DEFAULT\}/$vault}"
  printf '%s' "$value"
}

variable_exists() {
  local key="$1"
  local env_target="$2"
  set +e
  run_vercel env ls "$env_target" </dev/null 2>/dev/null | grep -q "\b${key}\b"
  local exists=$?
  set -e
  return "$exists"
}

remove_existing_variable() {
  local key="$1"
  local env_target="$2"
  set +e
  run_vercel env rm "$key" "$env_target" --yes </dev/null >/dev/null 2>&1
  set -e
}

add_variable() {
  local key="$1"
  local env_target="$2"
  local secret_value="$3"
  local is_sensitive="$4"

  # Do not pipe the secret on stdin. Newer Vercel CLI prompts for a Preview
  # git branch and will consume stdin as the answer, so the value never lands.
  if [ "$env_target" = "preview" ]; then
    if [ "$is_sensitive" = true ]; then
      run_vercel env add "$key" "$env_target" "" \
        --value="$secret_value" \
        --sensitive \
        --yes \
        --non-interactive </dev/null
    else
      run_vercel env add "$key" "$env_target" "" \
        --value="$secret_value" \
        --yes \
        --non-interactive </dev/null
    fi
  else
    if [ "$is_sensitive" = true ]; then
      run_vercel env add "$key" "$env_target" \
        --value="$secret_value" \
        --sensitive \
        --yes \
        --non-interactive </dev/null
    else
      run_vercel env add "$key" "$env_target" \
        --value="$secret_value" \
        --yes \
        --non-interactive </dev/null
    fi
  fi
}

process_template() {
  local template_file="$1"
  local environment="$2"
  local saw_var_in_this_template=0

  echo "Pushing ${template_file} → Vercel ${environment}" >&2

  while IFS= read -r line || [ -n "$line" ]; do
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    if [ -n "$SINGLE_VAR" ] && [ "$key" != "$SINGLE_VAR" ]; then
      continue
    fi
    saw_var_in_this_template=1

    local secret_value=""
    local is_sensitive=false

    if [[ "$value" == op://* ]]; then
      local op_ref op_err
      op_ref="$(expand_op_ref "$value")"
      op_err_file="$(mktemp)"
      if ! secret_value="$(op read "$op_ref" 2>"$op_err_file")"; then
        op_err="$(tr -d '\r' <"$op_err_file")"
        rm -f "$op_err_file"
        if [[ "$op_err" == *"not currently signed in"* || "$op_err" == *"no active session"* ]]; then
          echo "1Password CLI has no active session. Run 'op signin' in this terminal, then retry." >&2
          exit 1
        fi
        echo "skip ${key} (not in 1Password: ${op_ref})" >&2
        continue
      fi
      rm -f "$op_err_file"
      is_sensitive=true
    else
      secret_value="$value"
      is_sensitive=false
    fi

    local trimmed="${secret_value#"${secret_value%%[![:space:]]*}"}"
    trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
    if [ -z "$trimmed" ]; then
      echo "skip ${key} (empty)" >&2
      continue
    fi
    secret_value="$trimmed"

    if variable_exists "$key" "$environment"; then
      if [ "$ONLY_NEW" = true ]; then
        echo "skip ${key} (already exists, --only-new)" >&2
        continue
      fi
      remove_existing_variable "$key" "$environment"
    fi

    if ! add_variable "$key" "$environment" "$secret_value" "$is_sensitive"; then
      echo "failed to set ${key} on Vercel ${environment}" >&2
      exit 1
    fi
    echo "set ${key} on Vercel ${environment}" >&2
    sleep 1
  done < "$template_file"

  if [ -n "$SINGLE_VAR" ] && [ "$saw_var_in_this_template" -eq 0 ]; then
    echo "No line for '${SINGLE_VAR}' in ${template_file} — nothing synced for ${environment}." >&2
  fi
}

if [ "$ENV_FILTER" = "all" ] || [ "$ENV_FILTER" = "preview" ]; then
  process_template "$PREVIEW_TEMPLATE" "preview"
fi

if [ "$ENV_FILTER" = "all" ] || [ "$ENV_FILTER" = "production" ]; then
  process_template "$PRODUCTION_TEMPLATE" "production"
fi
