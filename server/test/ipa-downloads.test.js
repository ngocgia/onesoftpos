const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { IpaRepository } = require('../src/services/ipaRepository');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const fixture = path.join(__dirname, 'fixtures/OnesoftPOS-1.0.0-unsigned.ipa');

async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-ipas-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { directory, repository: new IpaRepository(directory), ipa: await fs.readFile(fixture) };
}
const options = (version, extra = {}) => ({ version, filename: 'app.ipa', enabled: true, isDefault: true, uploadedBy: 1, ...extra });

test('IPA upload and validation work using Node built-ins only, without installed ZIP libraries', async t => {
  const { directory, ipa } = await setup(t);
  const file = path.join(__dirname, '../src/services/ipaRepository.js');
  const localRequire = createRequire(file);
  const module = { exports: {} };
  vm.runInNewContext(await fs.readFile(file, 'utf8'), {
    module, Buffer, require: name => {
      assert.ok(name.startsWith('node:'), `Unexpected dependency: ${name}`);
      return localRequire(name);
    }
  });
  const repository = new module.exports.IpaRepository(directory);
  assert.equal((await repository.list()).length, 0);
  await repository.upload(Readable.from(ipa), options('1.0.0'));
  assert.equal((await repository.list()).length, 1);
  assert.equal((await repository.download()).version, '1.0.0');
});

test('IPA releases persist, select exact versions, revoke links and never fall back silently', async t => {
  const { directory, repository, ipa } = await setup(t);
  await assert.rejects(repository.download(), { status: 404 });
  const one = await repository.upload(Readable.from(ipa), options('1.0.0'));
  const two = await repository.upload(Readable.from(ipa), options('1.0.1', { isDefault: false }));
  assert.equal((await repository.download()).id, one.id);
  assert.equal((await repository.download('1.0.1')).id, two.id);
  assert.equal((await new IpaRepository(directory).list()).length, 2);
  assert.equal(one.sha256.length, 64);
  await repository.update(two.id, { isDefault: true });
  assert.equal((await repository.download()).id, two.id);
  await repository.update(two.id, { enabled: false });
  await assert.rejects(repository.download('1.0.1'), { status: 404 });
  await assert.rejects(repository.download(), { status: 404 });
  assert.equal((await repository.download('1.0.0')).id, one.id);
  await assert.rejects(repository.update(two.id, { isDefault: true }), { status: 400 });
  await repository.update(two.id, { enabled: true, isDefault: true });
  await repository.remove(two.id);
  await assert.rejects(fs.access(repository.filePath(two.id)));
  await assert.rejects(repository.download(), { status: 404 });
});

test('IPA uploads reject invalid files, unsafe versions, oversize and duplicates without leftovers', async t => {
  const { directory, repository, ipa } = await setup(t);
  await assert.rejects(repository.upload(Readable.from('not an ipa'), options('1')), { status: 400 });
  await assert.rejects(repository.upload(Readable.from(ipa), options('../bad')), { status: 400 });
  await assert.rejects(repository.upload(Readable.from(ipa), options('1', { filename: 'app.html' })), { status: 400 });
  await assert.rejects(repository.upload(Readable.from(ipa), options('1', { enabled: false })), { status: 400 });
  const tiny = new IpaRepository(directory, 20);
  await assert.rejects(tiny.upload(Readable.from(ipa), options('1', { contentLength: ipa.length })), { status: 413 });
  await assert.rejects(tiny.upload(Readable.from(ipa), options('1')), { status: 413 });
  await Promise.all([repository.upload(Readable.from(ipa), options('1')), repository.upload(Readable.from(ipa), options('2', { isDefault: false }))]);
  await assert.rejects(repository.upload(Readable.from(ipa), options('1')), { status: 409 });
  assert.equal((await repository.list()).length, 2);
  const files = await fs.readdir(directory);
  assert.equal(files.filter(file => file.endsWith('.ipa')).length, 2);
  assert.equal(files.some(file => /\.(upload|tmp)$/.test(file)), false);
  assert.throws(() => repository.filePath('../releases.json'), { status: 404 });
});

test('built-in IPA validation rejects truncated archives, bad directory bounds and missing payload metadata', async t => {
  const { directory, repository, ipa } = await setup(t);
  const end = ipa.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end > 0);
  const central = ipa.readUInt32LE(end + 16);
  const altered = callback => { const copy = Buffer.from(ipa); callback(copy); return copy; };
  const invalidFiles = [
    ipa.subarray(0, ipa.length - 8),
    Buffer.from('PK\x03\x04 Payload/App.app/Info.plist'),
    altered(buffer => buffer.writeUInt32LE(ipa.length + 500, end + 16)),
    altered(buffer => buffer.writeUInt32LE(17 * 1024 * 1024, end + 12)),
    altered(buffer => buffer.writeUInt16LE(1, end + 4)),
    altered(buffer => buffer.writeUInt16LE(0xffff, end + 10)),
    altered(buffer => buffer.writeUInt16LE(buffer.readUInt16LE(central + 8) | 1, central + 8)),
    altered(buffer => buffer.writeUInt32LE(0xffffffff, central + 42)),
    altered(buffer => {
      let index = 0;
      while ((index = buffer.indexOf('Info.plist', index)) !== -1) {
        buffer.write('Info.txtxx', index); index += 10;
      }
    }),
    altered(buffer => {
      // Keep central Info.plist, but break local header
      const name = buffer.indexOf('Info.plist');
      buffer.write('Info.txtxx', name);
    })
  ];
  for (let index = 0; index < invalidFiles.length; index++) {
    await assert.rejects(repository.upload(Readable.from(invalidFiles[index]), options(`bad-${index}`)), { status: 400 });
  }
  assert.equal((await repository.list()).length, 0);
  assert.equal((await fs.readdir(directory)).length, 0);
});

test('download HTTP sends IPA attachments publicly while administration requires admin authorization', async t => {
  const { directory, ipa } = await setup(t);
  process.env.IPA_STORAGE_DIR = directory;
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const db = require('../src/config/db');
  const { JWT_SECRET } = require('../src/middleware/authMiddleware');
  const { adminRouter, download } = require('../src/routes/ipas');
  const app = express();
  app.use(express.json());
  app.use('/api/admin/ipas', adminRouter);
  app.get('/download-ipa', download);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const admin = db.memoryStore.users.find(user => ['SUPER_ADMIN', 'ADMIN'].includes(user.role) && user.status === 'ACTIVE');
  const cashier = db.memoryStore.users.find(user => user.role === 'CASHIER' && user.status === 'ACTIVE');
  const auth = user => ({ Authorization: `Bearer ${jwt.sign({ id: user.id, ver: 0 }, JWT_SECRET)}` });
  assert.equal((await fetch(`${base}/api/admin/ipas`)).status, 401);
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const url = `${base}/api/admin/ipas${['PUT', 'DELETE'].includes(method) ? '/fake-id' : ''}`;
    assert.equal((await fetch(url, { method, headers: auth(cashier) })).status, 403);
  }
  const uploaded = await fetch(`${base}/api/admin/ipas`, {
    method: 'POST', body: ipa,
    headers: { ...auth(admin), 'Content-Type': 'application/octet-stream', 'X-Ipa-Version': '1.0.0',
      'X-Ipa-Filename': 'app.ipa', 'X-Ipa-Enabled': 'true', 'X-Ipa-Default': 'true' }
  });
  assert.equal(uploaded.status, 201);
  const { release } = await uploaded.json();
  const response = await fetch(`${base}/download-ipa`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /attachment;.*Onesoft-POS-1.0.0.ipa/);
  assert.match(response.headers.get('content-type'), /application\/octet-stream/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), ipa);
  assert.equal((await fetch(`${base}/download-ipa?version=1.0.0`)).status, 200);
  const updated = await fetch(`${base}/api/admin/ipas/${release.id}`, {
    method: 'PUT', headers: { ...auth(admin), 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false })
  });
  assert.equal(updated.status, 200);
  assert.equal((await fetch(`${base}/download-ipa`)).status, 404);
  assert.equal((await fetch(`${base}/download-ipa?version=1.0.0`)).status, 404);
  assert.equal((await fetch(`${base}/download-ipa?version=..%2Freleases.json`)).status, 404);
  assert.equal((await fetch(`${base}/download-ipa?version[]=1.0.0`)).status, 400);
});

