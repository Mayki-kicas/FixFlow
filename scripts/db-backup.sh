#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

CONTAINER_POSTGRES_USER="$(docker compose exec -T db printenv POSTGRES_USER 2>/dev/null || true)"
CONTAINER_POSTGRES_DB="$(docker compose exec -T db printenv POSTGRES_DB 2>/dev/null || true)"

POSTGRES_USER="${POSTGRES_USER:-${CONTAINER_POSTGRES_USER:-maintenance}}"
POSTGRES_DB="${POSTGRES_DB:-${CONTAINER_POSTGRES_DB:-maintenance}}"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/db}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
FILENAME="fixflow_${POSTGRES_DB}_${TIMESTAMP}.dump"
TARGET_PATH="$BACKUP_DIR/$FILENAME"
TMP_PATH="$TARGET_PATH.tmp"

mkdir -p "$BACKUP_DIR"

echo "[backup] creating $TARGET_PATH"
docker compose exec -T db pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc \
  > "$TMP_PATH"

if [ ! -s "$TMP_PATH" ]; then
  rm -f "$TMP_PATH"
  echo "[backup] failed: generated dump is empty"
  exit 1
fi

mv "$TMP_PATH" "$TARGET_PATH"

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$TARGET_PATH" > "$TARGET_PATH.sha256"
  echo "[backup] checksum written: $TARGET_PATH.sha256"
fi

echo "[backup] done"
echo "$TARGET_PATH"
