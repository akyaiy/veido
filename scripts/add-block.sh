#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"

SERVER_URL=${SITE_SERVER_URL:-http://localhost:8080}
PUBLISHER=publisher
VISIBILITY=all
ACCESS_TOKEN=${SITE_ACCESS_TOKEN:-}
BLOCK_KEY= NAME= TYPE= SOURCE_DIR= FOLDER_KEY= FOLDER_NAME=

usage() {
  cat <<'EOF'
Usage: SITE_ACCESS_TOKEN=<access JWT> scripts/add-block.sh \
  --key BLOCK_KEY --name NAME --type ui-component|content --source-dir DIRECTORY \
  [--folder-key KEY --folder-name NAME]

Uploads the physical bundle through VFS, creates HTML Block metadata, and,
when --folder-key is supplied, adds the Block to blocks/tree.json using CAS.
EOF
}

while (($#)); do
  case "$1" in
    --server) SERVER_URL="$2"; shift 2 ;; --publisher) PUBLISHER="$2"; shift 2 ;;
    --visibility) VISIBILITY="$2"; shift 2 ;; --access-token) ACCESS_TOKEN="$2"; shift 2 ;;
    --key) BLOCK_KEY="$2"; shift 2 ;; --name) NAME="$2"; shift 2 ;;
    --type) TYPE="$2"; shift 2 ;; --source-dir) SOURCE_DIR="$2"; shift 2 ;;
    --folder-key) FOLDER_KEY="$2"; shift 2 ;; --folder-name) FOLDER_NAME="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;; *) printf 'unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

require() { command -v "$1" >/dev/null || { printf 'missing command: %s\n' "$1" >&2; exit 1; }; }
require curl; require jq
[[ -f .env ]] || { printf '%s\n' 'missing .env' >&2; exit 1; }
[[ -n "$ACCESS_TOKEN" && -n "$BLOCK_KEY" && -n "$NAME" && -n "$TYPE" && -n "$SOURCE_DIR" ]] || { usage >&2; exit 2; }
[[ -z "$FOLDER_KEY" || -n "$FOLDER_NAME" ]] || { printf '%s\n' '--folder-name is required with --folder-key' >&2; exit 2; }
[[ "$TYPE" == ui-component || "$TYPE" == content ]] || { printf '%s\n' '--type must be ui-component or content' >&2; exit 2; }

SITE_URI=$(awk -F= '/^SITE_URI=/{print $2; exit}' .env)
if [[ ! "$SITE_URI" =~ ^html@([^[]+)\[([^]]+)\]:///+$ ]]; then printf 'invalid SITE_URI in .env: %s\n' "$SITE_URI" >&2; exit 1; fi
SCOPE_KEY=${BASH_REMATCH[2]}; HTML_URI="${SITE_URI%/}/"; ROOT_URI="local@${PUBLISHER}[${SCOPE_KEY}]:///blocks/${BLOCK_KEY}"
encode_uri() { jq -rn --arg value "$1" '$value|@uri'; }
request() { local method=$1 path=$2 body=${3:-}; if [[ -n "$body" ]]; then curl -fsS -X "$method" "$SERVER_URL$path" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary "$body"; else curl -fsS -X "$method" "$SERVER_URL$path" -H "Authorization: Bearer $ACCESS_TOKEN"; fi; }
stat_code() { curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $ACCESS_TOKEN" --get "$SERVER_URL/api/v2/vfs/stat" --data-urlencode "uri=$1"; }
mkdir() { local uri=$1 code; code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$SERVER_URL/api/v2/vfs/directory?uri=$(encode_uri "$uri")" -H "Authorization: Bearer $ACCESS_TOKEN"); [[ "$code" == 201 || "$code" == 409 ]] || { printf 'mkdir %s failed: HTTP %s\n' "$uri" "$code" >&2; exit 1; }; }
upload() { local uri=$1 file=$2 code; code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$SERVER_URL/api/v2/vfs/file?uri=$(encode_uri "$uri")" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/octet-stream' --data-binary "@$file"); if [[ "$code" == 409 ]]; then code=$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "$SERVER_URL/api/v2/vfs/file?uri=$(encode_uri "$uri")" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/octet-stream' --data-binary "@$file"); fi; [[ "$code" == 200 || "$code" == 201 || "$code" == 204 ]] || { printf 'upload %s failed: HTTP %s\n' "$uri" "$code" >&2; exit 1; }; }

[[ -f "$SOURCE_DIR/content.md" ]] || { printf '%s\n' 'missing content.md' >&2; exit 1; }
if [[ "$TYPE" == ui-component ]]; then for file in style.css script.js; do [[ -f "$SOURCE_DIR/$file" ]] || { printf 'missing %s\n' "$file" >&2; exit 1; }; done; else [[ ! -e "$SOURCE_DIR/style.css" && ! -e "$SOURCE_DIR/script.js" ]] || { printf '%s\n' 'content Block must not contain style.css or script.js' >&2; exit 1; }; fi

[[ "$(stat_code "${HTML_URI}blocks/${BLOCK_KEY}/meta.json")" == 404 ]] || { printf 'Block %q already exists; refusing to overwrite metadata\n' "$BLOCK_KEY" >&2; exit 1; }
mkdir "local@${PUBLISHER}[${SCOPE_KEY}]:///blocks"; mkdir "$ROOT_URI"; upload "$ROOT_URI/content.md" "$SOURCE_DIR/content.md"
if [[ "$TYPE" == ui-component ]]; then upload "$ROOT_URI/style.css" "$SOURCE_DIR/style.css"; upload "$ROOT_URI/script.js" "$SOURCE_DIR/script.js"; fi
payload=$(jq -cn --arg key "$BLOCK_KEY" --arg name "$NAME" --arg type "$TYPE" --arg root "$ROOT_URI" --arg visibility "$VISIBILITY" '{block_key:$key,name:$name,type:$type,bundle_root_uri:$root,visible_to:[$visibility]}')
request POST "/api/v2/vfs/control?uri=$(encode_uri "${HTML_URI}blocks")&command=create" "$payload" >/dev/null

if [[ -n "$FOLDER_KEY" ]]; then
  tree=$(request GET "/api/v2/vfs/read?uri=$(encode_uri "${HTML_URI}blocks/tree.json")")
  next=$(jq -ce --arg key "$BLOCK_KEY" --arg folder "$FOLDER_KEY" --arg name "$FOLDER_NAME" '
    if any(.. | objects | .blocks? // empty | arrays | .[]?; . == $key) then error("block already occurs in tree")
    elif any(.folders[]?; .key == $folder) then .folders |= map(if .key == $folder then .blocks += [$key] else . end)
    else .folders += [{key:$folder,name:$name,blocks:[$key]}] end' <<<"$tree")
  curl -fsS -X PUT "$SERVER_URL/api/v2/vfs/file?uri=$(encode_uri "${HTML_URI}blocks/tree.json")" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary "$next" >/dev/null
fi
printf 'Created Block %s (%s) at %s\n' "$BLOCK_KEY" "$TYPE" "$ROOT_URI"
