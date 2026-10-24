#!/usr/bin/env bash
set -euo pipefail

ARCHIVE=${1:?Missing local application archive}
: "${SSH_HOST:?Missing SSH_HOST}" "${SSH_USER:?Missing SSH_USER}" "${SSH_PORT:?Missing SSH_PORT}"
: "${GITHUB_SHA:?Missing GITHUB_SHA}" "${DEPLOY_PATH:?Missing DEPLOY_PATH}" "${NODE_ACTIVATE:?Missing NODE_ACTIVATE}" "${RUNNER_TEMP:?Missing RUNNER_TEMP}"
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit SHA' >&2; exit 1; }
[[ "$SSH_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ && "$SSH_USER" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$ ]] || exit 1
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] && (( SSH_PORT > 0 && SSH_PORT < 65536 )) || exit 1
[[ -f "$ARCHIVE" && -f scripts/deploy-passenger.sh ]] || { echo 'Archive or deployment script not found' >&2; exit 1; }
CHECKSUM=$(sha256sum "$ARCHIVE" | cut -d ' ' -f 1)
umask 077
PAYLOAD=$(mktemp "$RUNNER_TEMP/deploy-payload.XXXXXXXX")
REMOTE_LOG=$(mktemp "$RUNNER_TEMP/deploy-log.XXXXXXXX")
trap 'rm -f -- "$PAYLOAD" "$REMOTE_LOG"' EXIT

# Send script and archive through one SSH stdin stream. No SFTP subsystem,
# SCP process or extra SSH connection is required by the hosting account.
{
  printf 'set -euo pipefail\numask 077\n'
  printf 'COMMIT=%q\nCHECKSUM=%q\nAPP_ROOT=%q\nNODE_ACTIVATE=%q\n' "$GITHUB_SHA" "$CHECKSUM" "$DEPLOY_PATH" "$NODE_ACTIVATE"
  cat <<'BOOTSTRAP'
DEPLOY_DIR="$HOME/.onesoft-deploy"
mkdir -p "$DEPLOY_DIR"
chmod 700 "$DEPLOY_DIR"
ARCHIVE="$DEPLOY_DIR/$COMMIT.tar.gz"
DEPLOY_SCRIPT=$(mktemp "$DEPLOY_DIR/deploy.XXXXXXXX")
COMPLETE=false
cleanup_upload() {
  status=$?
  rm -f -- "$ARCHIVE.upload" "$DEPLOY_SCRIPT"
  if [[ "$COMPLETE" != true && "$status" == 0 ]]; then
    echo 'Incomplete deployment stream; deployment did not finish.' >&2
    status=1
  fi
  exit "$status"
}
trap cleanup_upload EXIT
echo 'SSH connected; receiving application archive...'
base64 --decode > "$ARCHIVE.upload" <<'ONESOFT_ARCHIVE_BASE64'
BOOTSTRAP
  base64 "$ARCHIVE"
  printf '\nONESOFT_ARCHIVE_BASE64\n'
  cat <<'VERIFY'
printf '%s  %s\n' "$CHECKSUM" "$ARCHIVE.upload" | sha256sum --check --status
tar --list --gzip --file="$ARCHIVE.upload" > /dev/null
echo 'Archive received and SHA-256 verified.'
mv -- "$ARCHIVE.upload" "$ARCHIVE"
cat > "$DEPLOY_SCRIPT" <<'ONESOFT_DEPLOY_SCRIPT'
VERIFY
  cat scripts/deploy-passenger.sh
  printf '\nONESOFT_DEPLOY_SCRIPT\n'
  printf 'echo %q\nbash "$DEPLOY_SCRIPT" "$APP_ROOT" "$NODE_ACTIVATE" "$COMMIT"\n' 'Starting deployment of verified code...'
  printf 'COMPLETE=true\nprintf "ONESOFT_DEPLOY_COMPLETE:%%s\\n" "$COMMIT"\n'
} > "$PAYLOAD"

echo 'Uploading and deploying over one SSH connection (without SCP/SFTP)...'
# Never retry this combined operation automatically: a disconnect could happen
# after live files were changed. Check the log/commit marker before rerunning.
if ssh -T -i "$HOME/.ssh/deploy_key" -p "$SSH_PORT" \
  -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=30 \
  -o ConnectionAttempts=1 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  -o TCPKeepAlive=yes "$SSH_USER@$SSH_HOST" 'bash -se' < "$PAYLOAD" | tee "$REMOTE_LOG"; then
  if ! grep -Fxq "ONESOFT_DEPLOY_COMPLETE:$GITHUB_SHA" "$REMOTE_LOG"; then
    echo 'SSH ended without deployment completion confirmation. Check remote status before retrying.' >&2
    exit 1
  fi
  echo 'Remote deployment command completed.'
else
  code=$?
  echo 'SSH upload/deployment failed. Check the last remote log line before retrying. A disconnect after deployment starts may leave live files changed.' >&2
  if (( code == 255 )); then
    echo 'SSH transport failed: ask hosting to check firewall/IP blocks, SSH connection limits and server logs for this GitHub Actions run.' >&2
  fi
  exit "$code"
fi
