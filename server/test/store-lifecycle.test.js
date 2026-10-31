const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const express = require('express');
const jwt = require('jsonwebtoken');
const { storeAccessState, parseLifecycle } = require('../src/services/storeLifecycle');

const secret = 'store-lifecycle-test-secret';
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } }; }
function load(relative, overrides = {}) {
  const file = path.join(__dirname, '../src', relative), realRequire = createRequire(file), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, console, process: { env: { JWT_SECRET: secret } },
    require: name => Object.prototype.hasOwnProperty.call(overrides, name) ? overrides[name] : realRequire(name) });
  return module.exports;
}
function database(connected = false) {
  const queries = [];
  const store = { id: 11, status: 'ACTIVE', usage_type: 'OFFICIAL', activation_at: null, expires_at: null };
  const memoryStore = { stores: [store], users: [{ id: 1, status: 'ACTIVE', role: 'SUPER_ADMIN' }, { id: 2, status: 'ACTIVE', role: 'STORE_MANAGER' }],
    user_stores: [{ user_id: 2, store_id: 11 }], store_settings: [], store_types: [], role_features: [], store_role_features: [] };
  const client = { release() {}, async query(sql, values) {
    queries.push({ sql, values });
    if (/SELECT.*FROM stores/.test(sql)) return { rowCount: 1, rows: [store] };
    if (sql.includes('INSERT INTO stores')) return { rowCount: 1, rows: [{ id: 12 }] };
    return { rowCount: 1, rows: [] };
  } };
  const db = { memoryStore, isPostgresConnected: () => connected, pool: { connect: async () => client, query: client.query } };
  return { db, store, queries, middleware: load('middleware/authMiddleware.js', { '../config/db': db }),
    controller: load('controllers/storeController.js', { '../config/db': db }) };
}

test('store activation and expiration use exact boundaries and preserve existing stores', () => {
  const store = { status: 'ACTIVE', activation_at: '2026-11-01T08:00:00+07:00', expires_at: '2026-12-01T08:00:00+07:00' };
  assert.equal(storeAccessState(store, Date.parse(store.activation_at) - 1), 'NOT_STARTED');
  assert.equal(storeAccessState(store, Date.parse(store.activation_at)), 'ACTIVE');
  assert.equal(storeAccessState(store, Date.parse(store.expires_at) - 1), 'ACTIVE');
  assert.equal(storeAccessState(store, Date.parse(store.expires_at)), 'EXPIRED');
  assert.equal(storeAccessState({ status: 'ACTIVE' }), 'ACTIVE');
  assert.equal(storeAccessState({ ...store, status: 'INACTIVE' }), 'LOCKED');
});

test('lifecycle validates date order, timezone and usage type, preserving omitted fields and allowing removal', () => {
  const current = { activation_at: '2026-11-01T00:00:00Z', expires_at: '2026-12-01T00:00:00Z' };
  assert.deepEqual(parseLifecycle({ name: 'Store' }, current), {});
  assert.deepEqual(parseLifecycle({ activation_at: '', expires_at: null }), { activation_at: null, expires_at: null });
  assert.equal(parseLifecycle({ activation_at: '2026-11-01T08:00+07:00' }).activation_at, '2026-11-01T01:00:00.000Z');
  for (const patch of [{ usage_type: 'bad' }, { status: 'bad' }, { activation_at: '2026-11-01T08:00' },
    { expires_at: '2026-02-30T08:00:00Z' }, { expires_at: current.activation_at }, { activation_at: '2027-01-01T00:00:00Z' }]) {
    assert.throws(() => parseLifecycle(patch, current), { statusCode: 400 });
  }
});

for (const connected of [false, true]) {
  test(`store lifecycle is saved, cleared and restricted to global admins (${connected ? 'database' : 'memory'})`, async () => {
    const h = database(connected), user = { role: 'ADMIN' };
    const req = { user, params: { id: '11' }, body: { usage_type: 'TRIAL', activation_at: '2026-01-01T00:00:00Z', expires_at: '2027-01-01T00:00:00Z' } };
    const res = response(); await h.controller.updateStore(req, res);
    assert.equal(res.code, 200);
    if (connected) {
      const query = h.queries.find(q => q.sql.startsWith('UPDATE stores'));
      assert.equal(query.values[10], 'TRIAL');
      assert.equal(query.values[8].toISOString(), req.body.activation_at.replace('Z', '.000Z'));
      assert.equal(query.values[12], true);
      assert.ok(h.queries.some(q => q.sql.includes('FOR UPDATE')));
    } else assert.equal(h.store.usage_type, 'TRIAL');
    const denied = response(); await h.controller.updateStore({ ...req, user: { role: 'STORE_MANAGER' } }, denied);
    assert.equal(denied.code, 403);
    const cleared = response(); await h.controller.updateStore({ ...req, body: { activation_at: null, expires_at: null } }, cleared);
    assert.equal(cleared.code, 200);
    if (!connected) { assert.equal(h.store.activation_at, null); assert.equal(h.store.expires_at, null); }
    const bad = response(); await h.controller.updateStore({ ...req, body: { activation_at: '2027-01-01T00:00:00Z', expires_at: '2026-01-01T00:00:00Z' } }, bad);
    assert.equal(bad.code, 400);
    const created = response(); await h.controller.createStore({ user, body: { code: 'NEW', name: 'New Store', store_type_id: 1, usage_type: 'TRIAL', expires_at: '2027-01-01T00:00:00Z' } }, created);
    assert.equal(created.code, 201);
    if (connected) assert.equal(h.queries.find(q => q.sql.includes('INSERT INTO stores')).values[11], 'TRIAL');
    else assert.equal(h.db.memoryStore.stores.at(-1).usage_type, 'TRIAL');
  });

  test(`expiry blocks existing sessions, including admins, and renewal restores access (${connected ? 'database' : 'memory'})`, async () => {
    const h = database(connected), req = { user: { role: 'ADMIN' }, headers: {}, query: {}, body: {}, storeId: 11 };
    for (const [patch, code] of [[{ expires_at: '2000-01-01T00:00:00Z' }, 'STORE_EXPIRED'], [{ expires_at: null, activation_at: '2099-01-01T00:00:00Z' }, 'STORE_NOT_STARTED'], [{ activation_at: null, status: 'INACTIVE' }, 'STORE_LOCKED']]) {
      Object.assign(h.store, patch);
      const res = response(); await h.middleware.requireStoreContext()(req, res, () => assert.fail('locked request accepted'));
      assert.equal(res.code, 403); assert.equal(res.body.code, code);
    }
    Object.assign(h.store, { status: 'ACTIVE', activation_at: null, expires_at: '2099-01-01T00:00:00Z' });
    let passed = false;
    await h.middleware.requireStoreContext()(req, response(), () => { passed = true; });
    assert.equal(passed, true);
    h.store.expires_at = '2000-01-01T00:00:00Z';
    let canRenew = false;
    await h.middleware.requireStoreAccess()({ ...req, params: { id: '11' } }, response(), () => { canRenew = true; });
    assert.equal(canRenew, true);
  });
}

test('every operational API route rejects expired stores before calling business controllers', async t => {
  const h = database(), called = [];
  h.store.expires_at = '2000-01-01T00:00:00Z';
  const terminal = new Proxy({}, { get: (_, name) => (req, res) => { called.push(name); res.json({ success: true }); } });
  const file = path.join(__dirname, '../src/routes/api.js'), realRequire = createRequire(file), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, require: name => name.includes('authMiddleware') ? h.middleware
    : name.includes('auditMiddleware') ? { audit: () => (req, res, next) => next() }
      : name.includes('controllers/') ? terminal : realRequire(name) });
  const router = module.exports, app = express(); app.use(express.json()); app.use('/api', router);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ id: 1, ver: 0 }, secret);
  const paths = router.stack.filter(layer => layer.route && !/^\/(auth|admin|stores|store-types|landing)(\/|$)/.test(layer.route.path));
  assert.ok(paths.length > 60);
  for (const layer of paths) {
    const method = Object.keys(layer.route.methods)[0].toUpperCase();
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${layer.route.path.replace(/:[A-Za-z]+/g, '1')}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'X-Store-Id': '11', 'Content-Type': 'application/json' },
      ...(method !== 'GET' ? { body: '{}' } : {})
    });
    assert.equal(response.status, 403, `${method} ${layer.route.path}`);
    assert.equal((await response.json()).code, 'STORE_EXPIRED');
  }
  assert.deepEqual(called, []);
});

test('expired stores prevent staff login, while admins retain management access', async () => {
  const h = database();
  h.store.expires_at = '2000-01-01T00:00:00Z';
  Object.assign(h.db.memoryStore.users[1], { username: 'manager', password_hash: 'hash' });
  Object.assign(h.db.memoryStore.users[0], { username: 'admin', password_hash: 'hash' });
  const auth = load('controllers/authController.js', { '../config/db': h.db, '../middleware/authMiddleware': { JWT_SECRET: secret },
    bcryptjs: { compare: async () => true } });
  const res = response(); await auth.login({ body: { username: 'manager', password: 'test' } }, res);
  assert.equal(res.code, 403); assert.equal(res.body.code, 'STORE_EXPIRED');
  const admin = response(); await auth.login({ body: { username: 'admin', password: 'test' } }, admin);
  assert.equal(admin.code, 200); assert.ok(admin.body.token);
  h.store.expires_at = '2099-01-01T00:00:00Z';
  const renewed = response(); await auth.login({ body: { username: 'manager', password: 'test' } }, renewed);
  assert.equal(renewed.code, 200); assert.ok(renewed.body.token);
});

test('store form preserves UTC+7 dates and submits ISO timestamps with usage type', async () => {
  const window = {}, document = { addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/admin-page.js'), 'utf8'), { window, document, console });
  const app = window.adminApp, calls = [];
  app.esc = value => String(value ?? '');
  app.stores = [{ id: 11, usage_type: 'TRIAL', activation_at: '2026-11-01T01:00:00Z', expires_at: '2026-12-01T01:00:00Z' }];
  app.storeTypes = [];
  window.api = { get: async () => ({ settings: {} }), put: async (url, body) => calls.push({ url, body }) };
  let html, submit;
  app.openModal = (title, body, callback) => { html = body; submit = callback; };
  app.toast = () => {}; app.loadStores = async () => {};
  await app.editStore(11);
  assert.match(html, /name="activation_at"[^>]*value="2026-11-01T08:00"/);
  assert.match(html, /name="usage_type"/);
  await submit({ usage_type: 'TRIAL', activation_at: '2026-11-01T08:00', expires_at: '2026-12-01T08:00' });
  assert.equal(calls[0].body.activation_at, '2026-11-01T01:00:00.000Z');
  assert.equal(calls[0].body.expires_at, '2026-12-01T01:00:00.000Z');
  assert.equal(calls[0].body.usage_type, 'TRIAL');
});
