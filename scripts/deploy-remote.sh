#!/bin/sh
set -eu

# Deploy/update script for production (no Docker on remote host).
# It syncs source code, builds on the remote machine, runs Prisma migrations,
# prepares Next.js standalone runtime, and (optionally) installs/restarts systemd.

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/fixflow}"
APP_SERVICE="${APP_SERVICE:-fixflow}"
APP_PORT="${APP_PORT:-3000}"

FIRST_DEPLOY="false"
RUN_MIGRATIONS="true"
UPLOAD_ENV_FILE=""

usage() {
  cat <<'EOF'
Usage:
  sh scripts/deploy-remote.sh [options]

Required environment:
  DEPLOY_HOST                Remote host (example: 203.0.113.12)

Optional environment:
  DEPLOY_USER=ubuntu
  DEPLOY_PORT=22
  DEPLOY_PATH=/opt/fixflow
  APP_SERVICE=fixflow
  APP_PORT=3000

Options:
  --first-deploy             Install and enable systemd service if missing
  --no-migrate               Skip "prisma migrate deploy"
  --upload-env <file>        Upload this file as remote shared/.env
  -h, --help                 Show help

Examples:
  DEPLOY_HOST=203.0.113.12 sh scripts/deploy-remote.sh --first-deploy --upload-env .env
  DEPLOY_HOST=203.0.113.12 sh scripts/deploy-remote.sh
EOF
}

while [ "${1:-}" != "" ]; do
  case "$1" in
    --first-deploy)
      FIRST_DEPLOY="true"
      ;;
    --no-migrate)
      RUN_MIGRATIONS="false"
      ;;
    --upload-env)
      shift
      UPLOAD_ENV_FILE="${1:-}"
      if [ -z "$UPLOAD_ENV_FILE" ]; then
        echo "Missing value for --upload-env"
        exit 1
      fi
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [ -z "$DEPLOY_HOST" ]; then
  echo "DEPLOY_HOST is required."
  usage
  exit 1
fi

if [ -n "$UPLOAD_ENV_FILE" ] && [ ! -f "$UPLOAD_ENV_FILE" ]; then
  echo "Env file not found: $UPLOAD_ENV_FILE"
  exit 1
fi

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH="ssh -p $DEPLOY_PORT"
RSYNC_SSH="ssh -p $DEPLOY_PORT"

echo "[deploy] target: $REMOTE"
echo "[deploy] path: $DEPLOY_PATH"

echo "[deploy] preparing remote directories..."
$SSH "$REMOTE" "mkdir -p '$DEPLOY_PATH/shared' '$DEPLOY_PATH/src' '$DEPLOY_PATH/current' '$DEPLOY_PATH/releases'"

echo "[deploy] uploading source (app/)..."
rsync -az --delete \
  -e "$RSYNC_SSH" \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude ".env" \
  --exclude ".DS_Store" \
  --exclude "tsconfig.tsbuildinfo" \
  app/ "$REMOTE:$DEPLOY_PATH/src/"

echo "[deploy] uploading deployment helper files..."
rsync -az \
  -e "$RSYNC_SSH" \
  scripts/systemd/fixflow.service.template \
  "$REMOTE:$DEPLOY_PATH/shared/"

if [ -n "$UPLOAD_ENV_FILE" ]; then
  echo "[deploy] uploading env file -> $DEPLOY_PATH/shared/.env"
  rsync -az -e "$RSYNC_SSH" "$UPLOAD_ENV_FILE" "$REMOTE:$DEPLOY_PATH/shared/.env"
fi

echo "[deploy] running remote build/deploy steps..."
$SSH "$REMOTE" \
  "DEPLOY_PATH='$DEPLOY_PATH' APP_SERVICE='$APP_SERVICE' APP_PORT='$APP_PORT' FIRST_DEPLOY='$FIRST_DEPLOY' RUN_MIGRATIONS='$RUN_MIGRATIONS' DEPLOY_USER='$DEPLOY_USER' bash -s" <<'EOF'
set -euo pipefail

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command on remote host: $1"
    exit 1
  fi
}

need_cmd node
need_cmd npm
need_cmd rsync

if [ ! -f "$DEPLOY_PATH/shared/.env" ]; then
  echo "Missing $DEPLOY_PATH/shared/.env"
  echo "Create it (or rerun local deploy with --upload-env <file>) then retry."
  exit 1
fi

DATABASE_URL="$(awk -F= '/^DATABASE_URL=/{sub(/^DATABASE_URL=/,""); print; exit}' "$DEPLOY_PATH/shared/.env")"
if [ -z "${DATABASE_URL:-}" ] && [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "DATABASE_URL is missing in $DEPLOY_PATH/shared/.env"
  exit 1
fi

# Security preflight to avoid deploying a broken/unreachable app.
NEXTAUTH_URL="$(awk -F= '/^NEXTAUTH_URL=/{sub(/^NEXTAUTH_URL=/,""); print; exit}' "$DEPLOY_PATH/shared/.env")"
ALLOWED_HOSTS="$(awk -F= '/^ALLOWED_HOSTS=/{sub(/^ALLOWED_HOSTS=/,""); print; exit}' "$DEPLOY_PATH/shared/.env" | tr -d '[:space:]')"
FORCE_HTTPS="$(awk -F= '/^FORCE_HTTPS=/{sub(/^FORCE_HTTPS=/,""); print; exit}' "$DEPLOY_PATH/shared/.env")"
DEV_AUTH_BYPASS="$(awk -F= '/^DEV_AUTH_BYPASS=/{sub(/^DEV_AUTH_BYPASS=/,""); print; exit}' "$DEPLOY_PATH/shared/.env")"
NEXT_PUBLIC_DEV_AUTH_BYPASS="$(awk -F= '/^NEXT_PUBLIC_DEV_AUTH_BYPASS=/{sub(/^NEXT_PUBLIC_DEV_AUTH_BYPASS=/,""); print; exit}' "$DEPLOY_PATH/shared/.env")"

if [ "${DEV_AUTH_BYPASS:-false}" = "true" ] || [ "${NEXT_PUBLIC_DEV_AUTH_BYPASS:-false}" = "true" ]; then
  echo "[preflight] Refusing deploy: DEV_AUTH_BYPASS must be false in production."
  exit 1
fi

if [ "${FORCE_HTTPS:-false}" = "true" ] && [ -n "${NEXTAUTH_URL:-}" ]; then
  case "$NEXTAUTH_URL" in
    https://*) ;;
    *)
      echo "[preflight] Refusing deploy: FORCE_HTTPS=true but NEXTAUTH_URL is not https ($NEXTAUTH_URL)."
      exit 1
      ;;
  esac
fi

if [ -n "${ALLOWED_HOSTS:-}" ] && [ -n "${NEXTAUTH_URL:-}" ]; then
  NEXTAUTH_HOST="$(printf '%s' "$NEXTAUTH_URL" | sed -E 's#^[a-zA-Z]+://##' | sed -E 's#/.*$##')"
  case ",$ALLOWED_HOSTS," in
    *,"$NEXTAUTH_HOST",*) ;;
    *)
      echo "[preflight] Refusing deploy: NEXTAUTH_URL host ($NEXTAUTH_HOST) is missing from ALLOWED_HOSTS ($ALLOWED_HOSTS)."
      exit 1
      ;;
  esac
fi

if [ -z "${ALLOWED_HOSTS:-}" ]; then
  echo "[preflight] Warning: ALLOWED_HOSTS is empty (host allowlist disabled)."
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RELEASE_DIR="$DEPLOY_PATH/releases/$TIMESTAMP"
mkdir -p "$RELEASE_DIR"

rsync -a --delete "$DEPLOY_PATH/src/" "$RELEASE_DIR/src/"

cd "$RELEASE_DIR/src"

echo "[remote] installing dependencies..."
npm ci --include=dev

echo "[remote] prisma generate..."
npm run prisma:generate

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[remote] prisma migrate deploy..."
  DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
fi

echo "[remote] building app..."
npm run build

echo "[remote] preparing standalone runtime..."
mkdir -p "$RELEASE_DIR/runtime"
rsync -a --delete .next/standalone/ "$RELEASE_DIR/runtime/"
mkdir -p "$RELEASE_DIR/runtime/.next"
rsync -a --delete .next/static/ "$RELEASE_DIR/runtime/.next/static/"
if [ -d public ]; then
  rsync -a public/ "$RELEASE_DIR/runtime/public/"
fi

# Prisma engines/runtime files for production runtime.
if [ -d node_modules/.prisma ]; then
  mkdir -p "$RELEASE_DIR/runtime/node_modules"
  rsync -a node_modules/.prisma/ "$RELEASE_DIR/runtime/node_modules/.prisma/"
fi
if [ -d prisma ]; then
  rsync -a prisma/ "$RELEASE_DIR/runtime/prisma/"
fi

ln -sfn "$RELEASE_DIR/runtime" "$DEPLOY_PATH/current"

if [ "$FIRST_DEPLOY" = "true" ]; then
  echo "[remote] installing/updating systemd unit $APP_SERVICE.service..."
  UNIT_TMP="/tmp/$APP_SERVICE.service"
  sed \
    -e "s|__DEPLOY_PATH__|$DEPLOY_PATH|g" \
    -e "s|__APP_SERVICE__|$APP_SERVICE|g" \
    -e "s|__APP_PORT__|$APP_PORT|g" \
    -e "s|__APP_USER__|$DEPLOY_USER|g" \
    "$DEPLOY_PATH/shared/fixflow.service.template" > "$UNIT_TMP"

  sudo mv "$UNIT_TMP" "/etc/systemd/system/$APP_SERVICE.service"
  sudo systemctl daemon-reload
  sudo systemctl enable --now "$APP_SERVICE.service"
else
  echo "[remote] restarting $APP_SERVICE.service..."
  sudo systemctl restart "$APP_SERVICE.service"
fi

echo "[remote] deployment done."
EOF

echo "[deploy] done."
