const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');
const { decodeImage, saveImage, MAX_IMAGE_BYTES } = require('../src/services/productImages');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'onesoft-product-images-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('uploaded photo persists per store with unique filenames and survives a later read', async t => {
  const directory = await temporaryDirectory(t);
  const one = await saveImage(11, png, directory);
  const two = await saveImage(12, png, directory);
  assert.match(one, /^\/uploads\/products\/11\/[a-f0-9-]+\.png$/);
  assert.match(two, /^\/uploads\/products\/12\/[a-f0-9-]+\.png$/);
  const stored = await fs.readFile(path.join(directory, one.replace('/uploads/products/', '')));
  assert.ok(stored.equals(decodeImage(png).bytes));
  assert.notEqual(one, await saveImage(11, png, directory));
});

test('image upload rejects oversized, malformed, mismatched and executable content', async t => {
  const directory = await temporaryDirectory(t);
  for (const input of [null, 'https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/jpeg;base64,PGh0bWw+eDwvaHRtbD4=', png.replace('image/png', 'image/jpeg'),
    'data:image/png;base64,AAAA', `data:image/png;base64,${Buffer.alloc(MAX_IMAGE_BYTES + 1).toString('base64')}`]) {
    assert.throws(() => decodeImage(input), { status: 400 });
  }
  await assert.rejects(saveImage('../11', png, directory), { status: 400 });
  assert.deepEqual(await fs.readdir(directory), []);
});

test('HTTP upload enforces real auth, management role and store assignment, serves the saved image', async t => {
  const directory = await temporaryDirectory(t);
  const db = { isPostgresConnected: () => false, memoryStore: {
    users: [
      { id: 1, role: 'ADMIN', status: 'ACTIVE' },
      { id: 2, role: 'STORE_MANAGER', status: 'ACTIVE' },
      { id: 3, role: 'CASHIER', status: 'ACTIVE' }
    ], stores: [{ id: 11, status: 'ACTIVE' }], user_stores: [{ user_id: 2, store_id: 11 }, { user_id: 3, store_id: 11 }]
  } };
  const authFile = path.join(__dirname, '../src/middleware/authMiddleware.js');
  const authRequire = createRequire(authFile);
  const authModule = { exports: {} };
  vm.runInNewContext(await fs.readFile(authFile, 'utf8'), {
    module: authModule, process: { env: { JWT_SECRET: 'image-test-secret' } }, console,
    require: name => name === '../config/db' ? db : authRequire(name)
  });
  const routeFile = path.join(__dirname, '../src/routes/productImages.js');
  const routeRequire = createRequire(routeFile);
  const routeModule = { exports: {} };
  vm.runInNewContext(await fs.readFile(routeFile, 'utf8'), {
    module: routeModule, console,
    require: name => name.includes('authMiddleware') ? authModule.exports
      : name.includes('auditMiddleware') ? { audit: () => (req, res, next) => next() }
        : name.includes('services/productImages') ? { saveImage: (id, image) => saveImage(id, image, directory) } : routeRequire(name)
  });
  const app = express();
  app.use('/api/product-images', routeModule.exports);
  app.use('/uploads/products', express.static(directory, { setHeaders: res => res.set('X-Content-Type-Options', 'nosniff') }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = (user, store, image = png) => fetch(`${origin}/api/product-images`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user, ver: 0 }, 'image-test-secret')}` } : {}), ...(store ? { 'X-Store-Id': String(store) } : {}) },
    body: JSON.stringify({ image })
  });
  assert.equal((await send(null, 11)).status, 401);
  assert.equal((await send(3, 11)).status, 403);
  assert.equal((await send(2, 12)).status, 403);
  assert.equal((await send(1, null)).status, 400);
  assert.equal((await send(1, 11, 'x'.repeat(2200000))).status, 413);
  assert.equal((await send(1, 11, 'broken')).status, 400);
  const response = await send(2, 11);
  assert.equal(response.status, 201);
  const body = await response.json();
  const image = await fetch(origin + body.image_url);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /image\/png/);
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(Buffer.from(await image.arrayBuffer()).equals(decodeImage(png).bytes));
  db.memoryStore.stores[0].expires_at = '2000-01-01T00:00:00Z';
  const expired = await send(2, 11);
  assert.equal(expired.status, 403);
  assert.equal((await expired.json()).code, 'STORE_EXPIRED');
});

test('menu sorts Vietnamese names A-Z before names starting with numbers under category and search filters', async () => {
  const grid = { innerHTML: '', querySelectorAll: () => [] };
  const window = { api: { formatMoney: String } };
  const document = { getElementById: id => id === 'productsGrid' ? grid : null };
  const context = vm.createContext({ window, document, console, WeakMap });
  for (const file of ['product-images', 'pos']) {
    vm.runInContext(await fs.readFile(path.join(__dirname, `../../public/js/${file}.js`), 'utf8'), context);
  }
  const pos = window.posModule;
  pos.products = [
    { id: 1, name: 'Trà sữa', code: 'TS', price: 1, category_id: 2, image_url: '/uploads/products/11/photo.jpg' },
    { id: 2, name: 'Gà rán', code: 'GA', price: 2, category_id: 1 },
    { id: 3, name: 'Bánh 10', code: 'B10', price: 3, category_id: 1 },
    { id: 4, name: 'bánh 2', code: 'B2', price: 4, category_id: 1 },
    { id: 5, name: 'Đậu hũ', code: 'DH', price: 5, category_id: 2 },
    { id: 6, name: '10 Gà rán', code: 'GA10', price: 6, category_id: 1 },
    { id: 7, name: ' 2 Gà rán', code: 'GA2', price: 7, category_id: 1 }
  ];
  const names = () => [...grid.innerHTML.matchAll(/class="product-title">([^<]*)</g)].map(match => match[1]);
  pos.renderProducts();
  assert.deepEqual(names(), ['bánh 2', 'Bánh 10', 'Đậu hũ', 'Gà rán', 'Trà sữa', ' 2 Gà rán', '10 Gà rán']);
  assert.equal(pos.products[0].id, 1, 'sorting must not mutate the catalog');
  assert.match(grid.innerHTML, /<img class="product-photo"/);
  pos.selectedCategory = '1';
  pos.renderProducts();
  assert.deepEqual(names(), ['bánh 2', 'Bánh 10', 'Gà rán', ' 2 Gà rán', '10 Gà rán']);
  pos.selectedCategory = 'all';
  pos.searchKeyword = 'bánh';
  pos.renderProducts();
  assert.deepEqual(names(), ['bánh 2', 'Bánh 10']);
  pos.searchKeyword = 'gà';
  pos.renderProducts();
  assert.deepEqual(names(), ['Gà rán', ' 2 Gà rán', '10 Gà rán']);
  assert.ok(!window.productImages.render('<script>x</script>').includes('<script>'));
  assert.ok(!window.productImages.render('javascript:alert(1)').includes('<img'));
});
