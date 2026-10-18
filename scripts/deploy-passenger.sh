#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=${1:?Missing application root}
NODE_ACTIVATE=${2:?Missing Node environment activation file}
COMMIT=${3:?Missing commit SHA}
[[ "$COMMIT" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit SHA' >&2; exit 1; }
[[ "$APP_ROOT" = "$HOME/"* && "$APP_ROOT" != "$HOME/" ]] || { echo 'Application root must be inside the hosting account home' >&2; exit 1; }
[[ -f "$APP_ROOT/server/src/server.js" && -f "$NODE_ACTIVATE" ]] || {
  echo 'Application root or Node environment not found. Check DEPLOY_PATH and NODE_ACTIVATE.' >&2; exit 1;
}

DEPLOY_DIR="$HOME/.onesoft-deploy"
ARCHIVE="$DEPLOY_DIR/$COMMIT.tar.gz"
[[ -f "$ARCHIVE" ]] || { echo 'Deployment archive not found' >&2; exit 1; }
STAGING=$(mktemp -d "$DEPLOY_DIR/staging.XXXXXXXX")
cleanup() {
  rm -rf -- "$STAGING"
  rm -f -- "$ARCHIVE"
}
trap cleanup EXIT

# CloudLinux activation scripts may reference unset shell variables.
set +u
source "$NODE_ACTIVATE"
set -u
node -e 'if (Number(process.versions.node.split(".")[0]) < 18) process.exit(1)'
tar --extract --gzip --file="$ARCHIVE" --directory="$STAGING" --no-same-owner
cd "$APP_ROOT/server"

# Complete dependency installation before changing live application code.
if ! cmp -s "$STAGING/server/package-lock.json" "$APP_ROOT/server/package-lock.json" ||
   ! node -e 'require.resolve("express"); require.resolve("mysql2"); require.resolve("pg")' >/dev/null 2>&1; then
  echo 'Installing updated production dependencies in staging...'
  npm ci --prefix "$STAGING/server" --omit=dev
  mkdir -p "$APP_ROOT/server/node_modules"
  cp -a "$STAGING/server/node_modules/." "$APP_ROOT/server/node_modules/"
fi

# The archive contains code only: no .env, .htaccess, uploaded APKs or node_modules.
# Do not delete server files absent from Git; they may be hosting configuration.
tar --extract --gzip --file="$ARCHIVE" --directory="$APP_ROOT" --no-same-owner --no-overwrite-dir
mkdir -p "$APP_ROOT/tmp"
touch "$APP_ROOT/tmp/restart.txt"
printf '%s\n' "$COMMIT" > "$APP_ROOT/tmp/deployed-commit.txt"
echo "Deployed $COMMIT; Passenger will reload on a subsequent request."
