#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"
SERVER_URL=${SITE_SERVER_URL:-http://localhost:8080}
PUBLISHER=publisher ACCESS_TOKEN=${SITE_ACCESS_TOKEN:-} PAGE_KEY= SOURCE_DIR=

usage() { printf '%s\n' 'Usage: SITE_ACCESS_TOKEN=<access JWT> scripts/update-page-bundle.sh --key PAGE_KEY --source-dir DIRECTORY'; }
while (($#)); do case "$1" in --server) SERVER_URL="$2"; shift 2;; --publisher) PUBLISHER="$2"; shift 2;; --access-token) ACCESS_TOKEN="$2"; shift 2;; --key) PAGE_KEY="$2"; shift 2;; --source-dir) SOURCE_DIR="$2"; shift 2;; -h|--help) usage; exit 0;; *) printf 'unknown argument: %s\n' "$1" >&2; exit 2;; esac; done
require() { command -v "$1" >/dev/null || { printf 'missing command: %s\n' "$1" >&2; exit 1; }; }
require curl; require jq
[[ -f .env && -n "$ACCESS_TOKEN" && -n "$PAGE_KEY" && -n "$SOURCE_DIR" ]] || { usage >&2; exit 2; }
SITE_URI=$(awk -F= '/^SITE_URI=/{print $2; exit}' .env)
[[ "$SITE_URI" =~ ^html@[^[]+\[([^]]+)\]:///+$ ]] || { printf 'invalid SITE_URI in .env: %s\n' "$SITE_URI" >&2; exit 1; }
SCOPE_KEY=${BASH_REMATCH[1]}; HTML_URI="${SITE_URI%/}/"; ROOT_URI="local@${PUBLISHER}[${SCOPE_KEY}]:///pages/${PAGE_KEY}"
encode() { jq -rn --arg value "$1" '$value|@uri'; }
status() { curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $ACCESS_TOKEN" --get "$SERVER_URL/api/v2/vfs/stat" --data-urlencode "uri=$1"; }
[[ "$(status "${HTML_URI}pages/${PAGE_KEY}/info.json")" == 200 ]] || { printf 'Page %q does not exist or is not visible\n' "$PAGE_KEY" >&2; exit 1; }
for file in content.md style.css script.js; do
  [[ -f "$SOURCE_DIR/$file" ]] || { printf 'missing page file: %s\n' "$SOURCE_DIR/$file" >&2; exit 1; }
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "$SERVER_URL/api/v2/vfs/file?uri=$(encode "$ROOT_URI/$file")" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/octet-stream' --data-binary "@$SOURCE_DIR/$file")
  [[ "$code" == 200 || "$code" == 204 ]] || { printf 'update %s failed: HTTP %s\n' "$file" "$code" >&2; exit 1; }
done
printf 'Updated Page bundle %s\n' "$PAGE_KEY"
