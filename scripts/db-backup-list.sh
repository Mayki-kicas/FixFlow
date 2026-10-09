#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/db}"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "No backup directory found: $BACKUP_DIR"
  exit 0
fi

ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null || echo "No backup files found in $BACKUP_DIR"
