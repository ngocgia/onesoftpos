const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';

test('hosting pulls the pinned archive with no workflow token, verifies it and publishes only application code', { skip: !existsSync(bash) }, async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'onesoft-download-test-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const root = folder.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase());
  await fs.mkdir(path.join(folder, 'scripts'));
  await fs.copyFile(path.join(__dirname, '../../scripts/deploy-via-download.sh'), path.join(folder, 'scripts/deploy-via-download.sh'));
  await fs.writeFile(path.join(folder, 'scripts/deploy-passenger.sh'), `#!/usr/bin/env bash
set -euo pipefail
tar -tzf "$TEST_REMOTE/$3.tar.gz" > "$TEST_REMOTE/published-files"
printf '%s\\n' "$1" "$2" "$3" > "$TEST_REMOTE/deployed-args"
`);
  for (const file of ['public/index.html', 'public/.env.local', 'server/src/server.js', 'server/package.json', 'server/package-lock.json', 'server/data/private.txt', 'package.json', '.env', 'android-pos/app.apk']) {
    const target = path.join(folder, 'repository', file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, 'fixture');
  }
  const archive = spawnSync(bash, ['-c', 'tar -czf source.tar.gz repository'], { cwd: folder, encoding: 'utf8' });
  assert.equal(archive.status, 0, archive.stderr);
  for (const mode of ['success', 'download-fails', 'corrupt', 'truncated']) {
    const remote = path.join(folder, `remote-${mode}`);
    const calls = path.join(folder, `calls-${mode}`);
    const env = { ...process.env, SSH_HOST: 'example.invalid', SSH_PORT: '22', SSH_USER: 'deploy',
      GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'owner/project', GH_TOKEN: 'test-token-never-forward',
      DEPLOY_PATH: "/home/deploy/app with 'quotes'", NODE_ACTIVATE: '/home/deploy/node env/activate', RUNNER_TEMP: root,
      TEST_REMOTE: `${root}/remote-${mode}`, TEST_MODE: mode, TEST_CALLS: `${root}/calls-${mode}`, TEST_SOURCE_ARCHIVE: `${root}/source.tar.gz` };
    const mock = `
curl() {
  cat >/dev/null
  local headers='' output=''
  while (( $# )); do
    case "$1" in
      --dump-header) headers=$2; shift 2 ;;
      --output) output=$2; shift 2 ;;
      *) shift ;;
    esac
  done
  if [[ -n "$headers" ]]; then printf 'HTTP/2 302\\r\\nLocation: https://codeload.github.com/owner/project/legacy.tar.gz/aaaaaaaa?token=temporary\\r\\n' > "$headers"; return 0; fi
  if [[ "$output" == "$TEST_REMOTE/"* && "$TEST_MODE" == download-fails ]]; then return 28; fi
  cp "$TEST_SOURCE_ARCHIVE" "$output"
  if [[ "$output" == "$TEST_REMOTE/"* && "$TEST_MODE" == corrupt ]]; then printf corrupted >> "$output"; fi
}
ssh() {
  printf x >> "$TEST_CALLS"
  cat > "$RUNNER_TEMP/payload-$TEST_MODE"
  if grep -q 'test-token-never-forward' "$RUNNER_TEMP/payload-$TEST_MODE"; then echo 'Token leaked to hosting' >&2; return 99; fi
  if [[ "$TEST_MODE" == truncated ]]; then return 0; fi
  sed 's|^DEPLOY_DIR=.*|DEPLOY_DIR="$TEST_REMOTE"|' "$RUNNER_TEMP/payload-$TEST_MODE" | bash -se
}
export -f curl ssh
bash scripts/deploy-via-download.sh
`;
    const result = spawnSync(bash, ['-c', mock], { cwd: folder, env, encoding: 'utf8', timeout: 15000 });
    assert.equal(await fs.readFile(calls, 'utf8'), 'x', 'Exactly one SSH command');
    if (mode === 'success') {
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const files = await fs.readFile(path.join(remote, 'published-files'), 'utf8');
      assert.match(files, /public\/index.html/);
      assert.match(files, /server\/src\/server.js/);
      assert.doesNotMatch(files, /\.env|private.txt|android-pos/);
      assert.deepEqual((await fs.readFile(path.join(remote, 'deployed-args'), 'utf8')).trimEnd().split('\n'), [env.DEPLOY_PATH, env.NODE_ACTIVATE, env.GITHUB_SHA]);
    } else {
      assert.notEqual(result.status, 0, mode + ' unexpectedly succeeded');
      assert.equal(existsSync(path.join(remote, 'deployed-args')), false);
    }
  }
});
