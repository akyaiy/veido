#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  printf '%s\n' 'missing .env; copy .env.example and set JWT_SECRET first' >&2
  exit 1
fi

exec go run ./cmd/migrate "$@"
