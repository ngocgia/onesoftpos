const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../src/config/db');
const landing = require('../src/controllers/landingController');
const catalog = require('../../public/data/landing-fields.json');
const { JWT_SECRET } = require('../src/middleware/authMiddleware');
function response() {
  return { code: 200, set() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
}

test('landing settings persist globally without overwriting staff/store settings; failures are explicit', async () => {
  const savedPool = db.pool, savedConnected = db.isPostgresConnected;
  const records = new Map([['store:1:printer', '{"paperSize":"K80"}']]);
  db.isPostgresConnected = () => true;
  db.pool = { query: async (sql, args) => {
    const key = args.slice(0, 3).join(':');
    if (sql.startsWith('INSERT')) { records.set(key, args[3]); return { rows: [] }; }
    return { rows: records.has(key) ? [{ payload: records.get(key) }] : [] };
  } };
  try {
    const key = catalog.find(field => field.group === 'hero' && field.type === 'text').key;
    const overrides = { [key]: 'Nội dung cửa hàng tự chỉnh', 'price.monthly.basic': '150.000₫' };
    const written = response();
    await landing.put({ body: { overrides } }, written);
    assert.equal(written.code, 200);
    const read = response(); await landing.get({ path: '/landing' }, read);
    assert.deepEqual(read.data.overrides, overrides);
    assert.equal(read.data.fields, undefined);
    assert.equal(records.get('store:1:printer'), '{"paperSize":"K80"}');
    const admin = response(); await landing.get({ path: '/admin/landing' }, admin);
    assert.equal(admin.data.fields.length, catalog.length);
    db.pool.query = async () => { throw new Error('Offline'); };
    const failed = response(); await landing.put({ body: { overrides } }, failed);
    assert.equal(failed.code, 500);
    assert.equal(failed.data.success, undefined);
    db.isPostgresConnected = () => false;
    const offline = response(); await landing.put({ body: { overrides } }, offline);
    assert.equal(offline.code, 503);
  } finally { db.pool = savedPool; db.isPostgresConnected = savedConnected; }
});

test('content rejects unknown fields and script URLs; text remains text and dynamic prices are editable', () => {
  const link = catalog.find(field => field.type === 'link').key;
  for (const value of ['javascript:alert(1)', 'data:text/html,test', '//evil.example', '/\\evil.example', '\njavascript:alert(1)']) {
    assert.throws(() => landing.validateOverrides({ [link]: value }));
  }
  assert.throws(() => landing.validateOverrides({ arbitraryHTML: '<script>alert(1)</script>' }));
  assert.throws(() => landing.validateOverrides({ 'price.monthly.basic': 150000 }));
  assert.equal(landing.validateOverrides({ [link]: '/?mode=pos' })[link], '/?mode=pos');
  const key = catalog.find(field => field.type === 'text').key;
  assert.equal(landing.validateOverrides({ [key]: '<img onerror=alert(1)>' })[key], '<img onerror=alert(1)>');
});

test('consultation only reports success after DB write; validates phone and preserves submitted data', async () => {
  const savedPool = db.pool, savedConnected = db.isPostgresConnected;
  const input = { name: 'Chị Lan', phone: '0901234567', store: 'Quán Mộc', industry: 'Cafe', package: 'Pro', note: 'Cần tư vấn in hóa đơn' };
  let saved;
  db.isPostgresConnected = () => true;
  db.pool = { query: async (sql, args) => { saved = args; return { rows: [] }; } };
  try {
    const result = response(); await landing.contact({ body: input }, result);
    assert.equal(result.code, 201);
    assert.equal(saved[0], 'lead');
    assert.deepEqual(JSON.parse(saved[3]), input);
    assert.throws(() => landing.validateLead({ ...input, phone: 'abc' }));
    assert.throws(() => landing.validateLead({ ...input, note: 'x'.repeat(2001) }));
    db.pool.query = async () => { throw new Error('No space'); };
    const failed = response(); await landing.contact({ body: input }, failed);
    assert.equal(failed.code, 500);
    assert.equal(failed.data.success, undefined);
  } finally { db.pool = savedPool; db.isPostgresConnected = savedConnected; }
});

test('root opens landing; Android URL and POS assets remain available; admin content requires admin role', async t => {
  const app = express();
  app.use(require('../src/routes/siteEntry'));
  app.use(express.static(require('node:path').join(__dirname, '../../public')));
  app.use('/api', require('../src/routes/api'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const path of ['/', '/index.html']) assert.match(await (await fetch(base + path)).text(), /data-landing-text/);
  for (const path of ['/?mode=pos', '/index.html?mode=pos', '/pos']) {
    const html = await (await fetch(base + path)).text();
    assert.match(html, /id="app" class="app-container"/);
    assert.doesNotMatch(html, /data-landing-text/);
  }
  assert.equal((await fetch(base + '/css/main.css')).status, 200);
  assert.equal((await fetch(base + '/js/invoice.js')).status, 200);
  for (const path of ['/api/admin/landing', '/api/admin/landing/leads']) {
    assert.equal((await fetch(base + path)).status, 401);
    const token = jwt.sign({ id: 3 }, JWT_SECRET);
    assert.equal((await fetch(base + path, { headers: { Authorization: 'Bearer ' + token } })).status, 403);
  }
});
