const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createImageStorage, decodeImage } = require('../src/services/productImages');
const { createR2Uploader } = require('../src/services/r2ProductImages');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const config = {
  PRODUCT_IMAGE_STORAGE: 'r2',
  R2_ENDPOINT: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com',
  R2_BUCKET: 'test-products', R2_PUBLIC_URL: 'https://pub-test.r2.dev/',
  R2_ACCESS_KEY_ID: 'test-key', R2_SECRET_ACCESS_KEY: 'test-secret'
};

test('R2 receives validated bytes, store-specific unique keys and cache metadata without local files', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-r2-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let clientOptions, constructions = 0;
  const commands = [];
  class Client {
    constructor(options) { clientOptions = options; constructions++; }
    async send(command) { commands.push(command.input); }
  }
  const save = createImageStorage({ env: config, directory, createR2Uploader: env => createR2Uploader(env, Client) });
  const urls = [await save(11, png), await save(11, png), await save(12, png)];
  assert.match(urls[0], /^https:\/\/pub-test\.r2\.dev\/products\/11\/[a-f0-9-]+\.png$/);
  assert.match(urls[2], /\/products\/12\//);
  assert.notEqual(urls[0], urls[1]);
  assert.equal(constructions, 1);
  assert.equal(clientOptions.region, 'auto');
  assert.equal(clientOptions.endpoint, config.R2_ENDPOINT);
  assert.deepEqual(clientOptions.credentials, { accessKeyId: 'test-key', secretAccessKey: 'test-secret' });
  assert.equal(commands[0].Bucket, 'test-products');
  assert.equal(commands[0].ContentType, 'image/png');
  assert.equal(commands[0].ContentLength, decodeImage(png).bytes.length);
  assert.ok(commands[0].Body.equals(decodeImage(png).bytes));
  assert.equal(commands[0].CacheControl, 'public, max-age=31536000, immutable');
  assert.deepEqual(await fs.readdir(directory), []);
});

test('R2 failure propagates and never silently writes to local storage', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pos-r2-fail-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const save = createImageStorage({ env: config, directory, createR2Uploader: () => async () => { throw new Error('offline'); } });
  await assert.rejects(save(11, png), /offline/);
  assert.deepEqual(await fs.readdir(directory), []);
});

test('invalid images and store IDs are rejected before any R2 access', async () => {
  const save = createImageStorage({ env: config, createR2Uploader: () => { assert.fail('must not access R2'); } });
  await assert.rejects(save('../11', png), { status: 400 });
  await assert.rejects(save(11, 'invalid'), { status: 400 });
});

test('missing credentials and incorrect endpoints fail before constructing the client', () => {
  class Client { constructor() { assert.fail('must not construct client'); } }
  for (const key of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_PUBLIC_URL', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
    assert.throws(() => createR2Uploader({ ...config, [key]: '' }, Client), /chưa được cấu hình/);
  }
  for (const patch of [
    { R2_ENDPOINT: `${config.R2_ENDPOINT}/test-products` },
    { R2_ENDPOINT: 'https://example.com' },
    { R2_PUBLIC_URL: 'http://example.com' },
    { R2_PUBLIC_URL: 'https://example.com/?token=secret' }
  ]) assert.throws(() => createR2Uploader({ ...config, ...patch }, Client), /không hợp lệ/);
});

test('unrecognized storage mode cannot silently fall back to local files', async () => {
  const save = createImageStorage({ env: { PRODUCT_IMAGE_STORAGE: 'r22' } });
  await assert.rejects(save(1, png), /phải là local hoặc r2/);
});
