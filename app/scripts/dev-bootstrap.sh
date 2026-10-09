#!/bin/sh
set -eu

cd /app

# Si le volume node_modules est vide/incomplet ou obsolète, on réinstalle.
LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
LOCK_STAMP_FILE="node_modules/.package-lock.hash"
INSTALLED_HASH=""
if [ -f "$LOCK_STAMP_FILE" ]; then
  INSTALLED_HASH="$(cat "$LOCK_STAMP_FILE" || true)"
fi

if [ ! -f node_modules/.bin/next ] || \
   [ ! -d node_modules/@prisma/client ] || \
   [ ! -d node_modules/jspdf ] || \
   [ "$INSTALLED_HASH" != "$LOCK_HASH" ]; then
  echo "[bootstrap] node_modules manquant, installation des dependances..."
  npm ci --include=dev
  echo "$LOCK_HASH" > "$LOCK_STAMP_FILE"
fi

# Toujours regénérer le client Prisma au démarrage pour éviter les erreurs runtime.
echo "[bootstrap] generation du client Prisma..."
npx prisma generate

echo "[bootstrap] demarrage de Next.js..."
exec npm run dev -- --hostname 0.0.0.0 --port 3000
