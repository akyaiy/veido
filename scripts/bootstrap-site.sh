#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_URL="http://localhost:8080"
MANIFEST="./site.bootstrap.json"
USERNAME=""
PASSWORD="${SITE_BOOTSTRAP_PASSWORD:-}"
ACCESS_TOKEN="${SITE_BOOTSTRAP_ACCESS_TOKEN:-}"

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap-site.sh --username USER [--password PASSWORD]

The server must already be running. If SITE_BOOTSTRAP_ACCESS_TOKEN is set,
authentication flags are unnecessary. The script logs in first and registers
the user only when login does not return an access token.
EOF
}

while (($#)); do
  case "$1" in
    --server) SERVER_URL="$2"; shift 2 ;;
    --manifest) MANIFEST="$2"; shift 2 ;;
    --username) USERNAME="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --access-token) ACCESS_TOKEN="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

require_command() { command -v "$1" >/dev/null || { printf 'missing command: %s\n' "$1" >&2; exit 1; }; }
require_command curl
require_command jq

if [[ ! -f .env ]]; then
  printf '%s\n' 'missing .env; copy .env.example and set JWT_SECRET first' >&2
  exit 1
fi
if [[ ! -f "$MANIFEST" ]]; then
  printf 'manifest not found: %s\n' "$MANIFEST" >&2
  exit 1
fi

hook() {
  local key="$1" payload="$2"
  curl -sS "$SERVER_URL/api/v2/vfs/hooks/$key/run" \
    -H 'Content-Type: application/json' \
    --data "$payload"
}

if [[ -z "$ACCESS_TOKEN" ]]; then
  [[ -n "$USERNAME" && -n "$PASSWORD" ]] || { usage >&2; exit 2; }
  credentials="$(jq -cn --arg username "$USERNAME" --arg password "$PASSWORD" '{input:{username:$username,password:$password}}')"
  auth_response="$(hook auth.login "$credentials")"
  ACCESS_TOKEN="$(jq -r '.output.access_token // empty' <<<"$auth_response")"
  if [[ -z "$ACCESS_TOKEN" ]]; then
    auth_response="$(hook auth.register "$credentials")"
    ACCESS_TOKEN="$(jq -r '.output.access_token // empty' <<<"$auth_response")"
  fi
  if [[ -z "$ACCESS_TOKEN" ]]; then
    printf 'authentication failed: %s\n' "$(jq -c '.error // .' <<<"$auth_response")" >&2
    exit 1
  fi
fi

bootstrap_output="$(go run ./cmd/sitebootstrap -server "$SERVER_URL" -access-token "$ACCESS_TOKEN" -manifest "$MANIFEST")"
site_uri="$(awk -F= '/^SITE_URI=/{print $2}' <<<"$bootstrap_output")"
if [[ -z "$site_uri" ]]; then
  printf 'bootstrap did not return SITE_URI: %s\n' "$bootstrap_output" >&2
  exit 1
fi

tmp_env="$(mktemp .env.XXXXXX)"
trap 'rm -f "$tmp_env"' EXIT
awk -v uri="$site_uri" '
  BEGIN { replaced = 0 }
  /^SITE_URI=/ { print "SITE_URI=" uri; replaced = 1; next }
  { print }
  END { if (!replaced) print "SITE_URI=" uri }
' .env >"$tmp_env"
mv "$tmp_env" .env
trap - EXIT

printf '%s\n' "$bootstrap_output"
printf 'Updated .env. Restart ./cmd/server, then open %s/\n' "$SERVER_URL"
