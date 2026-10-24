#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?Missing workflow GitHub token}" "${GITHUB_REPOSITORY:?Missing repository}" "${GITHUB_SHA:?Missing commit}"
: "${SSH_HOST:?Missing host}" "${SSH_USER:?Missing user}" "${SSH_PORT:?Missing port}"
: "${DEPLOY_PATH:?Missing application path}" "${NODE_ACTIVATE:?Missing Node activation path}" "${RUNNER_TEMP:?Missing temporary directory}"
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ && "$GITHUB_REPOSITORY" =~ ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$ ]] || exit 1
[[ "$SSH_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ && "$SSH_USER" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$ ]] || exit 1
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] && (( SSH_PORT > 0 && SSH_PORT < 65536 )) || exit 1
umask 077
WORK=$(mktemp -d "$RUNNER_TEMP/deploy-download.XXXXXXXX")
trap 'rm -rf -- "$WORK"' EXIT

# GitHub returns a short-lived codeload URL for this exact commit. Keep the
# workflow token on the runner; only this temporary URL is sent to the host.
printf 'header = "Authorization: Bearer %s"\n' "$GH_TOKEN" | curl --config - \
  --fail --silent --show-error --proto '=https' --connect-timeout 20 --max-time 60 \
  --dump-header "$WORK/headers" --output /dev/null \
  "https://api.github.com/repos/$GITHUB_REPOSITORY/tarball/$GITHUB_SHA"
DOWNLOAD_URL=$(sed -n 's/^[Ll]ocation: *//p' "$WORK/headers" | tr -d '\r' | tail -n 1)
[[ "$DOWNLOAD_URL" == https://codeload.github.com/* && "$DOWNLOAD_URL" != *[[:space:]\"\\]* ]] || {
  echo 'GitHub did not provide an expected HTTPS archive URL.' >&2; exit 1;
}
echo "::add-mask::$DOWNLOAD_URL"
printf 'url = "%s"\n' "$DOWNLOAD_URL" | curl --config - \
  --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --connect-timeout 20 --max-time 180 --output "$WORK/source.tar.gz"
CHECKSUM=$(sha256sum "$WORK/source.tar.gz" | cut -d ' ' -f 1)
{
  printf 'set -euo pipefail\numask 077\n'
  printf 'COMMIT=%q\nCHECKSUM=%q\nDOWNLOAD_URL=%q\nAPP_ROOT=%q\nNODE_ACTIVATE=%q\n' \
    "$GITHUB_SHA" "$CHECKSUM" "$DOWNLOAD_URL" "$DEPLOY_PATH" "$NODE_ACTIVATE"
  cat <<'REMOTE'
DEPLOY_DIR="$HOME/.onesoft-deploy"
mkdir -p "$DEPLOY_DIR"
chmod 700 "$DEPLOY_DIR"
WORK=$(mktemp -d "$DEPLOY_DIR/download.XXXXXXXX")
trap 'rm -rf -- "$WORK"' EXIT
echo 'SSH connected; hosting is downloading source from GitHub over HTTPS...'
printf 'url = "%s"\n' "$DOWNLOAD_URL" | curl --config - \
  --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --connect-timeout 20 --max-time 180 --output "$WORK/source.tar.gz"
unset DOWNLOAD_URL
printf '%s  %s\n' "$CHECKSUM" "$WORK/source.tar.gz" | sha256sum --check --status
echo 'Hosting download complete; SHA-256 verified.'
mkdir "$WORK/source"
tar --extract --gzip --file="$WORK/source.tar.gz" --directory="$WORK/source" --strip-components=1 --no-same-owner
cd "$WORK/source"
# Same code-only allowlist as the original deployment. Never publish the whole repository.
tar --exclude='.env' --exclude='.env.*' --exclude='.htaccess' --exclude='node_modules' --exclude='server/data' \
  -czf "$DEPLOY_DIR/$COMMIT.tar.gz" public server/src package.json server/package.json server/package-lock.json
cat > "$WORK/deploy.sh" <<'ONESOFT_DEPLOY_SCRIPT'
REMOTE
  cat scripts/deploy-passenger.sh
  printf '\nONESOFT_DEPLOY_SCRIPT\n'
  printf 'echo %q\nbash "$WORK/deploy.sh" "$APP_ROOT" "$NODE_ACTIVATE" "$COMMIT"\n' 'Starting deployment of verified code...'
  printf 'printf "ONESOFT_DEPLOY_COMPLETE:%%s\\n" "$COMMIT"\n'
} > "$WORK/command.sh"

echo 'Starting SSH command; application archive will be downloaded by hosting, not uploaded over SSH.'
if ssh -T -i "$HOME/.ssh/deploy_key" -p "$SSH_PORT" \
  -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=30 \
  -o ConnectionAttempts=1 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  -o TCPKeepAlive=yes "$SSH_USER@$SSH_HOST" 'bash -se' < "$WORK/command.sh" | tee "$WORK/remote.log"; then
  if ! grep -Fxq "ONESOFT_DEPLOY_COMPLETE:$GITHUB_SHA" "$WORK/remote.log"; then
    echo 'No deployment completion confirmation. Check remote status before retrying.' >&2; exit 1
  fi
else
  code=$?
  echo 'Hosting download/deploy failed. Check the last stage in the log; no automatic retry of deployment is performed.' >&2
  exit "$code"
fi
