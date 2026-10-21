#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_URL="${SITE_SERVER_URL:-http://localhost:8080}"
SESSION_FILE=".site-session"
ACCESS_TOKEN="${SITE_ACCESS_TOKEN:-}"

usage() {
  cat <<'EOF'
Usage: scripts/logout.sh [--access-token JWT]

Revokes the current JWT session through auth.logout and removes the local
session file created by scripts/login.sh.
EOF
}

while (($#)); do
  case "$1" in
    --server) SERVER_URL="$2"; shift 2 ;;
    --session-file) SESSION_FILE="$2"; shift 2 ;;
    --access-token) ACCESS_TOKEN="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

require_command() { command -v "$1" >/dev/null || { printf 'missing command: %s\n' "$1" >&2; exit 1; }; }
require_command curl

if [[ -z "$ACCESS_TOKEN" && -f "$SESSION_FILE" ]]; then
  # The file is generated locally by login.sh and only contains shell exports.
  # shellcheck disable=SC1090
  source "$SESSION_FILE"
  ACCESS_TOKEN="${SITE_ACCESS_TOKEN:-}"
  SERVER_URL="${SITE_SERVER_URL:-$SERVER_URL}"
fi
[[ -n "$ACCESS_TOKEN" ]] || { printf 'no access token; run scripts/login.sh first\n' >&2; exit 1; }

curl -fsS "$SERVER_URL/api/v2/vfs/hooks/auth.logout/run" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"input":{}}' >/dev/null

if [[ -f "$SESSION_FILE" ]]; then
  rm -f "$SESSION_FILE"
fi
printf '%s\n' 'Logged out; local session file removed.'
