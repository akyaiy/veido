#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT_DIR"
SERVER_URL=${SITE_SERVER_URL:-http://localhost:8080}
PUBLISHER=publisher
STATUS=ready
VISIBILITY=all
ACCESS_TOKEN=${SITE_ACCESS_TOKEN:-}
PAGE_KEY=
SLUG=
TITLE=
SOURCE_DIR=

usage() {
  cat <<'EOF'
Usage: SITE_ACCESS_TOKEN=<access JWT> scripts/add-page.sh \
  --key PAGE_KEY --slug URL_SLUG --title TITLE --source-dir DIRECTORY
EOF
}

while (($#)); do
  case "$1" in
    --server) SERVER_URL="$2"; shift 2 ;;
    --publisher) PUBLISHER="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --visibility) VISIBILITY="$2"; shift 2 ;;
    --access-token) ACCESS_TOKEN="$2"; shift 2 ;;
    --key) PAGE_KEY="$2"; shift 2 ;;
    --slug) SLUG="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --source-dir) SOURCE_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'unknown argument: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

require_command() { command -v "$1" >/dev/null || { printf 'missing command: %s\n' "$1" >&2; exit 1; }; }
require_command curl
require_command jq
if [[ -z "$ACCESS_TOKEN" || -z "$PAGE_KEY" || -z "$SLUG" || -z "$TITLE" || -z "$SOURCE_DIR" ]]; then
  usage >&2
  exit 2
fi
[[ -f .env ]] || { printf '%s\n' 'missing .env' >&2; exit 1; }

SITE_URI=$(awk -F= '/^SITE_URI=/{print $2; exit}' .env)
if [[ ! "$SITE_URI" =~ ^html@([^[]+)\[([^]]+)\]:///+$ ]]; then
  printf 'invalid SITE_URI in .env: %s\n' "$SITE_URI" >&2
  exit 1
fi
HTML_CONNECTION=${BASH_REMATCH[1]}
SCOPE_KEY=${BASH_REMATCH[2]}
HTML_URI="html@${HTML_CONNECTION}[${SCOPE_KEY}]:///"
ROOT_URI="local@${PUBLISHER}[${SCOPE_KEY}]:///pages/${PAGE_KEY}"

for file in content.md style.css script.js; do
  [[ -f "$SOURCE_DIR/$file" ]] || { printf 'missing page file: %s\n' "$SOURCE_DIR/$file" >&2; exit 1; }
done

encode_uri() { jq -rn --arg value "$1" '$value|@uri'; }
request() {
  local method=$1 path=$2 body=${3:-}
  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" "$SERVER_URL$path" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary "$body"
  else
    curl -fsS -X "$method" "$SERVER_URL$path" -H "Authorization: Bearer $ACCESS_TOKEN"
  fi
}
upload_file() {
  local uri=$1 source=$2 encoded_uri status
  encoded_uri=$(encode_uri "$uri")
  status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$SERVER_URL/api/v2/vfs/file?uri=$encoded_uri" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/octet-stream' --data-binary "@$source")
  case "$status" in
    201) return 0 ;;
    # The bundle may be a remainder of an interrupted add-page attempt. It is
    # safe to replace its three source files while no HTML page exists yet.
    409) curl -fsS -X PUT "$SERVER_URL/api/v2/vfs/file?uri=$encoded_uri" -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/octet-stream' --data-binary "@$source" >/dev/null ;;
    *) printf 'upload %s failed with HTTP %s\n' "$uri" "$status" >&2; return 1 ;;
  esac
}

resource_status() {
  local uri=$1 encoded_uri
  encoded_uri=$(encode_uri "$uri")
  curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $ACCESS_TOKEN" --get "$SERVER_URL/api/v2/vfs/stat" --data-urlencode "uri=$uri"
}

ensure_directory() {
  local uri=$1 encoded_uri status
  encoded_uri=$(encode_uri "$uri")
  status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$SERVER_URL/api/v2/vfs/directory?uri=$encoded_uri" -H "Authorization: Bearer $ACCESS_TOKEN")
  case "$status" in
    201) return 0 ;;
    409)
      [[ "$(resource_status "$uri")" == "200" ]] || { printf 'existing bundle path is not readable: %s\n' "$uri" >&2; return 1; }
      return 0
      ;;
    *) printf 'create directory %s failed with HTTP %s\n' "$uri" "$status" >&2; return 1 ;;
  esac
}

# Do not overwrite bundle files if a page is already registered. A 409 during
# the final control call is still possible if another user creates it in parallel.
page_info_uri="${HTML_URI}pages/${PAGE_KEY}/info.json"
case "$(resource_status "$page_info_uri")" in
  404) ;;
  200) printf 'page %q already exists; refusing to overwrite its bundle\n' "$PAGE_KEY" >&2; exit 1 ;;
  *) printf 'cannot check whether page %q exists\n' "$PAGE_KEY" >&2; exit 1 ;;
esac

ensure_directory "$ROOT_URI"
for file in content.md style.css script.js; do
  upload_file "$ROOT_URI/$file" "$SOURCE_DIR/$file" >/dev/null
done

tree_uri="${HTML_URI}tree.json"
encoded_tree_uri=$(encode_uri "$tree_uri")
tree=$(request GET "/api/v2/vfs/read?uri=$encoded_tree_uri")
revision=$(jq -er '.tree_revision' <<<"$tree")
payload=$(jq -cn --arg key "$PAGE_KEY" --arg slug "$SLUG" --arg title "$TITLE" --arg status "$STATUS" --arg root "$ROOT_URI" --arg visibility "$VISIBILITY" --argjson revision "$revision" '{expected_tree_revision:$revision,position:{last:true},page_key:$key,slug:$slug,title:$title,status:$status,bundle_root_uri:$root,visible_to:[$visibility]}')
pages_uri="${HTML_URI}pages"
encoded_pages_uri=$(encode_uri "$pages_uri")
request POST "/api/v2/vfs/control?uri=$encoded_pages_uri&command=create" "$payload" >/dev/null
printf 'Created %s/%s\n' "${SERVER_URL%/}" "$SLUG"
