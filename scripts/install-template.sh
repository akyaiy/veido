#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_URL="${SITE_SERVER_URL:-http://localhost:8080}"
MANIFEST="./site.bootstrap.json"
SESSION_FILE=".site-session"
ACCESS_TOKEN="${SITE_ACCESS_TOKEN:-}"
MAX_ATTEMPTS=3

usage() {
  cat <<'EOF'
Usage: scripts/install-template.sh [--access-token JWT] [--manifest FILE]

Installs a new immutable default-spa template version. The next numeric version
is chosen automatically from the versions already installed in SITE_URI.
EOF
}

while (($#)); do
  case "$1" in
    --server) SERVER_URL="$2"; shift 2 ;;
    --manifest) MANIFEST="$2"; shift 2 ;;
    --session-file) SESSION_FILE="$2"; shift 2 ;;
    --access-token) ACCESS_TOKEN="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

require_command() { command -v "$1" >/dev/null || { printf 'missing command: %s\n' "$1" >&2; exit 1; }; }
require_command curl
require_command jq
require_command go
[[ -f "$MANIFEST" ]] || { printf 'manifest not found: %s\n' "$MANIFEST" >&2; exit 1; }
[[ -f .env ]] || { printf '%s\n' 'missing .env' >&2; exit 1; }

if [[ -z "$ACCESS_TOKEN" && -f "$SESSION_FILE" ]]; then
  # The file is generated locally by login.sh and only contains shell exports.
  # shellcheck disable=SC1090
  source "$SESSION_FILE"
  ACCESS_TOKEN="${SITE_ACCESS_TOKEN:-}"
  SERVER_URL="${SITE_SERVER_URL:-$SERVER_URL}"
fi
[[ -n "$ACCESS_TOKEN" ]] || { printf 'no access token; run scripts/login.sh first\n' >&2; exit 1; }

SITE_URI="$(awk -F= '/^SITE_URI=/{print $2; exit}' .env)"
if [[ ! "$SITE_URI" =~ ^html@([^[]+)\[([^]]+)\]:///+$ ]]; then
  printf 'invalid SITE_URI in .env: %s\n' "$SITE_URI" >&2
  exit 1
fi

encode_uri() { jq -rn --arg value "$1" '$value | @uri'; }
next_version() {
  local uri encoded response
  uri="${SITE_URI}templates/default-spa"
  encoded="$(encode_uri "$uri")"
  response="$(curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" "$SERVER_URL/api/v2/vfs/list?uri=$encoded")"
  jq -er '([.items[].name | select(test("^[0-9]+$")) | tonumber] | max? // 0) + 1' <<<"$response"
}

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  version="$(next_version)"
  if output="$(go run ./cmd/sitebootstrap -server "$SERVER_URL" -access-token "$ACCESS_TOKEN" -manifest "$MANIFEST" -install-template-only -template-version "$version" 2>&1)"; then
    printf '%s\n' "$output"
    printf 'Installed default-spa/%s. Reload the browser with Ctrl+Shift+R.\n' "$version"
    exit 0
  fi
  if [[ "$output" != *'409 Conflict'* || "$attempt" -eq "$MAX_ATTEMPTS" ]]; then
    printf '%s\n' "$output" >&2
    exit 1
  fi
done
