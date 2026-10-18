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

op_agent="${OP_AGENT_BIN:-/Users/gaz/.local/bin/op-agent}"
if [ ! -x "$op_agent" ]; then
  echo "Registered 1Password helper is unavailable." >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is not on PATH." >&2
  exit 1
fi

# The registered service account does not request desktop or personal sign-in.
if ! "$op_agent" meatsack whoami >/dev/null 2>&1; then
  echo "Registered MEATSACK reader is unavailable; check op-agent meatsack access." >&2
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

add_variable() {
  local key="$1"
  local env_target="$2"
  local secret_value="$3"

  local args=(env add "$key" "$env_target")
  # An explicit empty Preview branch prevents the CLI reading the value as a branch.
  if [ "$env_target" = "preview" ]; then
    args+=("")
  fi
  # The team requires Sensitive storage for all server-side hosted variables.
  args+=(--sensitive)
  printf '%s' "$secret_value" | run_vercel "${args[@]}" --force --yes --non-interactive >/dev/null 2>&1
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

    if [[ "$value" == op://* ]]; then
      local op_ref
      op_ref="$(expand_op_ref "$value")"
      if ! secret_value="$("$op_agent" meatsack read "$op_ref" </dev/null 2>/dev/null)"; then
        echo "skip ${key} (unavailable in registered 1Password reader)" >&2
        continue
      fi
    else
      secret_value="$value"
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
    fi

    if ! add_variable "$key" "$environment" "$secret_value"; then
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

# Validate every selected deployment before changing any hosted variable.
validate_required() {
  local template_file="$1"
  local required_key reference resolved line
  for required_key in LANYARD_URL ASK_METADATA_SECRET CLEANROOM_URL CLEANROOM_SERVICE_CREDENTIAL CLEANROOM_WEBHOOK_SECRET; do
    reference=""
    while IFS= read -r line || [ -n "$line" ]; do
      if [[ "$line" == "$required_key="* ]]; then
        reference="${line#*=}"
        break
      fi
    done < "$template_file"
    resolved="$reference"
    if [[ "$reference" == op://* ]]; then
      if ! resolved="$("$op_agent" meatsack read "$(expand_op_ref "$reference")" </dev/null 2>/dev/null)"; then
        echo "Missing required ${required_key} for ${template_file}; nothing synced." >&2
        exit 1
      fi
    fi
    if [[ -z "${resolved//[[:space:]]/}" ]]; then
      echo "Missing required ${required_key} for ${template_file}; nothing synced." >&2
      exit 1
    fi
  done
}

if [ "$ENV_FILTER" = "all" ] || [ "$ENV_FILTER" = "preview" ]; then
  validate_required "$PREVIEW_TEMPLATE"
fi
if [ "$ENV_FILTER" = "all" ] || [ "$ENV_FILTER" = "production" ]; then
  validate_required "$PRODUCTION_TEMPLATE"
fi

if [ "$ENV_FILTER" = "all" ] || [ "$ENV_FILTER" = "preview" ]; then
  process_template "$PREVIEW_TEMPLATE" "preview"
fi

if [ "$ENV_FILTER" = "all" ] || [ "$ENV_FILTER" = "production" ]; then
  process_template "$PRODUCTION_TEMPLATE" "production"
fi
