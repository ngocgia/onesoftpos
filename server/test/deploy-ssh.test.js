const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash';

test('SSH deploy uses one shell connection, verifies payload, quotes paths and never retries failures', { skip: !existsSync(bash) }, async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'onesoft-ssh-test-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const root = folder.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase());
  await fs.mkdir(path.join(folder, 'scripts'));
  await fs.mkdir(path.join(folder, 'source'));
  await fs.writeFile(path.join(folder, 'source', 'code.txt'), 'application code');
  await fs.copyFile(path.join(__dirname, '../../scripts/deploy-over-ssh.sh'), path.join(folder, 'scripts/deploy-over-ssh.sh'));
  // Test the real SSH payload builder/receiver with a harmless deploy fixture.
  await fs.writeFile(path.join(folder, 'scripts/deploy-passenger.sh'), '#!/usr/bin/env bash\nset -euo pipefail\nprintf "%s\\n" "$1" "$2" "$3" > "$TEST_REMOTE/deployed-args"\n');
  const archive = spawnSync(bash, ['-c', 'tar -czf archive.tar.gz source'], { cwd: folder, encoding: 'utf8' });
  assert.equal(archive.status, 0, archive.stderr);
  for (const mode of ['success', 'corrupt', 'timeout', 'truncated']) {
    const remote = path.join(folder, `remote-${mode}`);
    const calls = path.join(folder, `calls-${mode}`);
    const env = { ...process.env, SSH_HOST: 'example.invalid', SSH_PORT: '22', SSH_USER: 'deploy',
      GITHUB_SHA: 'a'.repeat(40), DEPLOY_PATH: "/home/deploy/app with 'quotes'", NODE_ACTIVATE: '/home/deploy/node env/activate',
      RUNNER_TEMP: root, TEST_REMOTE: `${root}/remote-${mode}`, TEST_MODE: mode, TEST_CALLS: `${root}/calls-${mode}` };
    const mock = `
ssh() {
  printf x >> "$TEST_CALLS"
  if [[ "$TEST_MODE" == timeout ]]; then return 255; fi
  if [[ "$TEST_MODE" == truncated ]]; then cat > /dev/null; return 0; fi
  if [[ "$TEST_MODE" == corrupt ]]; then
    sed -e 's|^DEPLOY_DIR=.*|DEPLOY_DIR="$TEST_REMOTE"|' -e 's/^CHECKSUM=.*/CHECKSUM=${'0'.repeat(64)}/' | bash -se
  else
    sed -e 's|^DEPLOY_DIR=.*|DEPLOY_DIR="$TEST_REMOTE"|' | bash -se
  fi
}
export -f ssh
bash scripts/deploy-over-ssh.sh archive.tar.gz
`;
    const result = spawnSync(bash, ['-c', mock], { cwd: folder, env, encoding: 'utf8', timeout: 15000 });
    assert.equal(await fs.readFile(calls, 'utf8'), 'x', `Only one connection: ${mode}`);
    if (mode === 'success') {
      assert.equal(result.status, 0, result.stderr + result.stdout);
      assert.deepEqual((await fs.readFile(path.join(remote, 'deployed-args'), 'utf8')).trimEnd().split('\n'), [env.DEPLOY_PATH, env.NODE_ACTIVATE, env.GITHUB_SHA]);
      assert.match(result.stdout, /SHA-256 verified/);
    } else {
      assert.notEqual(result.status, 0, mode + ' unexpectedly succeeded');
      assert.equal(existsSync(path.join(remote, 'deployed-args')), false);
    }
  }
});
