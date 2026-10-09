#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

CONTAINER_POSTGRES_USER="$(docker compose exec -T db printenv POSTGRES_USER 2>/dev/null || true)"
CONTAINER_POSTGRES_DB="$(docker compose exec -T db printenv POSTGRES_DB 2>/dev/null || true)"

POSTGRES_USER="${POSTGRES_USER:-${CONTAINER_POSTGRES_USER:-maintenance}}"
POSTGRES_DB="${POSTGRES_DB:-${CONTAINER_POSTGRES_DB:-maintenance}}"
STOP_APP="true"

usage() {
  echo "Usage: sh scripts/db-restore.sh <backup.dump> [--no-app-stop]"
}

if [ "${1:-}" = "" ]; then
  usage
  exit 1
fi

DUMP_FILE="$1"
shift || true

while [ "${1:-}" != "" ]; do
  case "$1" in
    --no-app-stop)
      STOP_APP="false"
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift || true
done

if [ ! -f "$DUMP_FILE" ]; then
  echo "Backup file not found: $DUMP_FILE"
  exit 1
fi

if [ -f "$DUMP_FILE.sha256" ] && command -v shasum >/dev/null 2>&1; then
  echo "[restore] validating checksum..."
  shasum -a 256 -c "$DUMP_FILE.sha256"
fi

echo "[restore] restoring $DUMP_FILE into $POSTGRES_DB"

if [ "$STOP_APP" = "true" ]; then
  echo "[restore] stopping app container to reduce restore conflicts..."
  docker compose stop app >/dev/null 2>&1 || true
fi

cat "$DUMP_FILE" | docker compose exec -T db pg_restore \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges

if [ "$STOP_APP" = "true" ]; then
  echo "[restore] starting app container..."
  docker compose start app >/dev/null 2>&1 || true
fi

echo "[restore] done"
