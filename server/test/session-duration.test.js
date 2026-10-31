const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const jwt = require('jsonwebtoken');
const { parseSessionDays, getSessionDays } = require('../src/services/sessionDuration');

const secret = 'session-duration-test-secret';
function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function harness(database = false) {
  const memoryStore = { users: [], user_stores: [], stores: [], role_features: [], store_role_features: [] };
  const queries = [];
  const client = { release() {}, async query(sql, values) {
    queries.push({ sql, values });
    if (sql.includes('SELECT * FROM users')) return { rows: memoryStore.users.filter(u => u.username === values[0]) };
    if (sql.includes('SELECT u.role,')) return { rowCount: 1, rows: [{ role: 'CASHIER', store_ids: [11] }] };
    if (sql.includes('SELECT u.id FROM users')) return { rowCount: values[1] === 11 ? 1 : 0, rows: [] };
    if (sql.includes('INSERT INTO users')) return { rowCount: 1, rows: [{ id: 1, session_duration_days: values[8] }] };
    return { rowCount: 1, rows: [] };
  } };
  const db = { memoryStore, isPostgresConnected: () => database, pool: { connect: async () => client, query: client.query } };
  function load(relative) {
    const filename = path.join(__dirname, '../src', relative);
    const realRequire = createRequire(filename), module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      module, process: { env: { JWT_SECRET: secret } }, console: { error() {} },
      require: name => name.includes('config/db') ? db
        : name === 'bcryptjs' ? { hash: async () => 'hash', compare: async password => password === 'correct' }
          : name.includes('middleware/authMiddleware') ? { JWT_SECRET: secret } : realRequire(name)
    });
    return module.exports;
  }
  return { memoryStore, queries, auth: load('controllers/authController.js'), admin: load('controllers/adminController.js'),
    staff: load('controllers/storeStaffController.js'), middleware: load('middleware/authMiddleware.js') };
}

test('session days validation accepts 1–3650, defaults old accounts to 7, and rejects malformed settings', () => {
  for (const days of [1, 7, 30, 60, 3650]) assert.equal(parseSessionDays(String(days)), days);
  assert.equal(parseSessionDays(undefined), undefined);
  for (const invalid of [null, '', ' ', true, false, [], {}, 0, -1, 1.5, 3651, 'bad', Infinity]) {
    assert.throws(() => parseSessionDays(invalid), { statusCode: 400 });
  }
  for (const oldValue of [undefined, null, 0, 3651, 'bad']) assert.equal(getSessionDays(oldValue), 7);
});

for (const database of [false, true]) {
  test(`login signs each account's saved duration, ignoring client overrides (${database ? 'database' : 'memory'})`, async () => {
    const h = harness(database);
    for (const days of [undefined, 30, 60, 3650]) {
      h.memoryStore.users = [{ id: 1, username: 'user', role: 'CASHIER', password_hash: 'hash', status: 'ACTIVE', session_duration_days: days }];
      const res = response();
      await h.auth.login({ body: { username: 'user', password: 'correct', session_duration_days: 3650 } }, res);
      assert.equal(res.code, 200);
      const claims = jwt.verify(res.body.token, secret);
      assert.equal(claims.exp - claims.iat, (days ?? 7) * 86400);
      jwt.verify(res.body.token, secret, { clockTimestamp: claims.exp - 1 });
      assert.throws(() => jwt.verify(res.body.token, secret, { clockTimestamp: claims.exp }), { name: 'TokenExpiredError' });
    }
  });

  test(`admin create/update stores duration and omitted updates preserve it (${database ? 'database' : 'memory'})`, async () => {
    const h = harness(database), actor = { id: 99, role: 'ADMIN' };
    const created = response();
    await h.admin.createUser({ user: actor, body: { username: 'cashier', email: 'user@test.local', full_name: 'Thu ngân', password: 'correct', session_duration_days: '60' } }, created);
    assert.equal(created.code, 201);
    assert.equal(created.body.user.session_duration_days, 60);
    assert.equal(created.body.user.password_hash, undefined);
    const request = { user: actor, params: { id: '1' }, body: { session_duration_days: 30 } };
    const updated = response(); await h.admin.updateUser(request, updated);
    assert.equal(updated.code, 200);
    const omitted = response(); await h.admin.updateUser({ ...request, body: { phone: '123' } }, omitted);
    if (database) {
      const updates = h.queries.filter(q => q.sql.includes('UPDATE users SET'));
      assert.match(updates[0].sql, /session_duration_days=COALESCE\(\$10,session_duration_days\)/);
      assert.equal(updates[0].values[9], 30);
      assert.equal(updates[1].values[9], undefined);
    } else {
      assert.equal(h.memoryStore.users[0].session_duration_days, 30);
      const listed = response(); await h.admin.getUsers({}, listed);
      assert.equal(listed.body.users[0].session_duration_days, 30);
    }
    const invalid = response(); await h.admin.updateUser({ ...request, body: { session_duration_days: 0 } }, invalid);
    assert.equal(invalid.code, 400);
  });

  test(`staff duration uses store-scoped management and validates updates (${database ? 'database' : 'memory'})`, async () => {
    const h = harness(database);
    const created = response();
    await h.staff.createStaff({ storeId: 11, body: { username: 'staff', password: 'correct', email: 'staff@test.local', full_name: 'Nhân viên', session_duration_days: 60 } }, created);
    assert.equal(created.code, 201);
    assert.equal(created.body.user.session_duration_days, 60);
    const req = { storeId: 11, params: { id: '1' }, body: { session_duration_days: '30' } };
    const updated = response(); await h.staff.updateStaff(req, updated);
    assert.equal(updated.code, 200);
    if (database) {
      const update = h.queries.find(q => q.sql.includes('UPDATE users SET'));
      assert.match(update.sql, /session_duration_days=COALESCE\(\$9,session_duration_days\)/);
      assert.equal(update.values[8], 30);
    } else assert.equal(h.memoryStore.users[0].session_duration_days, 30);
    const denied = response(); await h.staff.updateStaff({ ...req, storeId: 12 }, denied);
    assert.equal(denied.code, 404);
    const invalid = response(); await h.staff.updateStaff({ ...req, body: { session_duration_days: null } }, invalid);
    assert.equal(invalid.code, 400);
  });
}

test('long sessions still check account status and token revocation on each request', async () => {
  const h = harness();
  const user = { id: 1, username: 'cashier', role: 'CASHIER', status: 'ACTIVE', token_version: 0 };
  h.memoryStore.users.push(user);
  const token = jwt.sign({ id: 1, ver: 0 }, secret, { expiresIn: '60d' });
  const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
  let passed = false;
  await h.middleware.authenticateToken(req, response(), () => { passed = true; });
  assert.equal(passed, true);
  user.token_version = 1;
  const revoked = response(); await h.middleware.authenticateToken(req, revoked, () => assert.fail('revoked token accepted'));
  assert.equal(revoked.code, 401);
  user.token_version = 0; user.status = 'INACTIVE';
  const locked = response(); await h.middleware.authenticateToken(req, locked, () => assert.fail('locked account accepted'));
  assert.equal(locked.code, 403);
});

test('both account editors show the saved duration and submit the chosen number', async () => {
  for (const file of ['admin-page', 'admin']) {
    const calls = [], roleSelect = { value: 'CASHIER', addEventListener() {} };
    const document = { addEventListener() {}, querySelector: () => roleSelect, querySelectorAll: () => [], getElementById: () => ({}) };
    const window = { api: { put: async (url, body) => calls.push({ url, body }), showToast() {} } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../../public/js/${file}.js`), 'utf8'), { window, document, console });
    const editor = file === 'admin-page' ? window.adminApp : window.adminModule;
    editor.esc = value => String(value ?? '');
    const user = { id: 1, role: 'CASHIER', session_duration_days: 60 };
    let html, submit;
    editor.users = [user]; editor.staff = [user]; editor.roles = ['CASHIER']; editor.staffRoles = ['CASHIER']; editor.stores = [];
    editor.openModal = editor.openEditor = (title, body, callback) => { html = body; submit = callback; };
    editor.toast = () => {}; editor.loadUsers = editor.loadStaff = async () => {};
    if (file === 'admin-page') editor.editUser(1); else editor.editStaff(1);
    assert.match(html, /name="session_duration_days"[^>]*value="60"/);
    assert.match(html, /min="1" max="3650" step="1" required/);
    await submit({ role: 'CASHIER', session_duration_days: '30', completed_items_enabled: 'inherit' });
    assert.equal(calls[0].body.session_duration_days, 30);
    assert.equal(calls[0].url, file === 'admin-page' ? '/admin/users/1' : '/store/staff/1');
  }
});
