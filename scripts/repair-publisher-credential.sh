#!/usr/bin/env bash
set -euo pipefail

# Repairs an interrupted/overwritten local publisher bootstrap in a local
# development database. This is intentionally not a normal publishing path:
# all ordinary content work must go through the VFS API.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_URL="${SITE_SERVER_URL:-http://localhost:8080}"
SESSION_FILE=".site-session"
ACCESS_TOKEN="${SITE_ACCESS_TOKEN:-}"
PUBLISHER="publisher"
CONFIRMED=false

usage() {
  cat <<'EOF'
Usage: scripts/repair-publisher-credential.sh --yes [--publisher CONNECTION]

Repairs a local publisher whose connection config secret no longer matches its
local account record. This is for local development recovery after a broken
or repeated bootstrap. It does not upload content or create a page.
EOF
}

while (($#)); do
  case "$1" in
    --server) SERVER_URL="$2"; shift 2 ;;
    --session-file) SESSION_FILE="$2"; shift 2 ;;
    --access-token) ACCESS_TOKEN="$2"; shift 2 ;;
    --publisher) PUBLISHER="$2"; shift 2 ;;
    --yes) CONFIRMED=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

require_command() { command -v "$1" >/dev/null || { printf 'missing command: %s\n' "$1" >&2; exit 1; }; }
require_command curl
require_command jq
require_command sqlite3
[[ "$CONFIRMED" == true ]] || { printf '%s\n' 'refusing database recovery without --yes' >&2; exit 2; }
[[ -f .env ]] || { printf '%s\n' 'missing .env' >&2; exit 1; }

if [[ -z "$ACCESS_TOKEN" && -f "$SESSION_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SESSION_FILE"
  ACCESS_TOKEN="${SITE_ACCESS_TOKEN:-}"
  SERVER_URL="${SITE_SERVER_URL:-$SERVER_URL}"
fi
[[ -n "$ACCESS_TOKEN" ]] || { printf '%s\n' 'no access token; run scripts/login.sh first' >&2; exit 1; }

SITE_URI="$(awk -F= '/^SITE_URI=/{print $2; exit}' .env)"
if [[ ! "$SITE_URI" =~ ^html@[^[]+\[([^]]+)\]:///$ ]]; then
  printf 'invalid SITE_URI in .env: %s\n' "$SITE_URI" >&2
  exit 1
fi
SCOPE_KEY="${BASH_REMATCH[1]}"

CONFIG_URI="scopes@scopes[system]:///scopes/${SCOPE_KEY}/connections/local@${PUBLISHER}/config.json"
CONFIG="$(curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" --get "$SERVER_URL/api/v2/vfs/read" --data-urlencode "uri=$CONFIG_URI")"
MODE="$(jq -er '.mode' <<<"$CONFIG")"
SUBJECT="$(jq -er '.subject_key' <<<"$CONFIG")"
SECRET="$(jq -er '.secret' <<<"$CONFIG")"

[[ "$MODE" == "account" ]] || { printf 'publisher %q is in %q mode, expected account\n' "$PUBLISHER" "$MODE" >&2; exit 1; }
[[ "$SUBJECT" =~ ^local:[A-Za-z0-9_-]+$ ]] || { printf '%s\n' 'invalid publisher subject key' >&2; exit 1; }
[[ -n "$SECRET" ]] || { printf '%s\n' 'publisher config has no secret' >&2; exit 1; }

HASH="$(printf %s "$SECRET" | sha256sum | awk '{print $1}')"
DB_PATH="$(awk -F= '/^DB_PATH=/{print $2; exit}' .env)"
[[ -n "$DB_PATH" ]] || { printf '%s\n' 'DB_PATH is missing from .env' >&2; exit 1; }

EXISTS="$(sqlite3 "$DB_PATH" "SELECT count(*) FROM local_accounts WHERE subject_key = '$SUBJECT' AND status = 'active';")"
[[ "$EXISTS" == "1" ]] || { printf '%s\n' 'active local account for publisher subject does not exist; credential cannot be repaired' >&2; exit 1; }

sqlite3 "$DB_PATH" "UPDATE local_accounts SET secret_hash = '$HASH', updated_at = CURRENT_TIMESTAMP WHERE subject_key = '$SUBJECT';"
unset SECRET CONFIG HASH

ROOT_URI="local@${PUBLISHER}[${SCOPE_KEY]}:///"
curl -fsS -H "Authorization: Bearer $ACCESS_TOKEN" --get "$SERVER_URL/api/v2/vfs/stat" --data-urlencode "uri=$ROOT_URI" >/dev/null
printf 'Repaired publisher %s in scope %s. The local account now opens through VFS.\n' "$PUBLISHER" "$SCOPE_KEY"
