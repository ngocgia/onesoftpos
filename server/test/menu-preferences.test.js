const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const controller = require('../src/controllers/menuPreferencesController');
const { translate } = require('../src/config/mysql');
const { schemaFor } = require('../src/db/menuPreferences');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
}
const speaker = { enableNewOrderSound: true, enableKitchenDoneSound: false, enableVietQRSpeech: true, volume: 0 };

test('menu settings round trip is isolated by store and user, including zero volume', async () => {
  const originalPool = db.pool, originalConnected = db.isPostgresConnected;
  const records = new Map();
  db.isPostgresConnected = () => true;
  db.pool = { query: async (sql, args) => {
    const key = JSON.stringify(args.slice(0, 3));
    if (sql.startsWith('INSERT')) { records.set(key, args[3]); return { rowCount: 1 }; }
    return { rows: records.has(key) ? [{ payload: records.get(key) }] : [] };
  } };
  try {
    const request = { path: '/store/menu-settings/speaker', params: { section: 'speaker' }, storeId: 11, user: { id: 7 }, body: speaker };
    const saved = response(); await controller.put(request, saved);
    assert.equal(saved.statusCode, 200);
    const restored = response(); await controller.get(request, restored);
    assert.deepEqual(restored.data.settings, speaker);
    const anotherStore = response(); await controller.get({ ...request, storeId: 12 }, anotherStore);
    assert.equal(anotherStore.data.settings, null);
    const header = { wishesText: 'Chào', avatarType: 'preset', avatarSrc: '', bgTheme: 'theme-slate-modern', showDecor: false };
    const personal = { ...request, path: '/auth/preferences/header', params: { section: 'header' }, body: header };
    await controller.put(personal, response());
    const anotherUser = response(); await controller.get({ ...personal, user: { id: 8 } }, anotherUser);
    assert.equal(anotherUser.data.settings, null);
    const invalidScope = response(); await controller.put({ ...personal, params: { section: 'speaker' }, body: speaker }, invalidScope);
    assert.equal(invalidScope.statusCode, 400);
  } finally { db.pool = originalPool; db.isPostgresConnected = originalConnected; }
});

test('rejects malformed settings, unknown fields, invalid channel combinations and non-finite numbers', () => {
  assert.throws(() => controller.validate('speaker', { ...speaker, volume: 101 }));
  assert.throws(() => controller.validate('speaker', { ...speaker, volume: NaN }));
  assert.throws(() => controller.validate('speaker', { ...speaker, extra: true }));
  assert.throws(() => controller.validate('workflow', { enableDineIn: false, enableTakeaway: false, enableDelivery: true, enableKds: true }));
  assert.throws(() => controller.validate('header', { wishesText: '', avatarType: 'upload', avatarSrc: 'javascript:alert(1)', bgTheme: '', showDecor: true }));
  for (const paperSize of ['K58', 'K80', 'K85', 'A4']) {
    const legacyPrinter = { paperSize, connectionType: 'browser', ipAddress: '', autoPrintOnPayment: false, autoCutPaper: false, printKitchenSeparate: false };
    assert.equal(controller.validate('printer', legacyPrinter).paperSize, paperSize);
    assert.equal(controller.validate('printer', legacyPrinter).autoPrintOrderSlipOnTransfer, false);
    assert.equal(controller.validate('printer', { ...legacyPrinter, autoPrintOrderSlipOnTransfer: true }).autoPrintOrderSlipOnTransfer, true);
    assert.throws(() => controller.validate('printer', { ...legacyPrinter, autoPrintOrderSlipOnTransfer: 'true' }));
  }
});

test('database failure never returns successful persistence or falls back to memory', async () => {
  const originalPool = db.pool, originalConnected = db.isPostgresConnected;
  const request = { path: '/store/menu-settings/speaker', params: { section: 'speaker' }, storeId: 11, user: { id: 7 }, body: speaker };
  try {
    db.isPostgresConnected = () => false;
    const offline = response(); await controller.put(request, offline);
    assert.equal(offline.statusCode, 503);
    db.isPostgresConnected = () => true;
    db.pool = { query: async () => { throw new Error('database write failed'); } };
    const failed = response(); await controller.put(request, failed);
    assert.equal(failed.statusCode, 500);
  } finally { db.pool = originalPool; db.isPostgresConnected = originalConnected; }
});

test('password change requires old password and persists a bcrypt hash for only the authenticated user', async () => {
  const originalPool = db.pool, originalConnected = db.isPostgresConnected;
  const hash = await bcrypt.hash('old-secret', 4);
  let written;
  db.isPostgresConnected = () => true;
  db.pool = { query: async (sql, args) => {
    if (sql.startsWith('SELECT')) return { rows: [{ password_hash: hash }] };
    written = args; return { rowCount: 1 };
  } };
  try {
    const bad = response(); await controller.changePassword({ user: { id: 7 }, body: { old_password: 'wrong', new_password: 'new-secret' } }, bad);
    assert.equal(bad.statusCode, 400); assert.equal(written, undefined);
    const good = response(); await controller.changePassword({ user: { id: 7 }, body: { old_password: 'old-secret', new_password: 'new-secret' } }, good);
    assert.equal(good.statusCode, 200); assert.equal(written[1], 7);
    assert.notEqual(written[0], 'new-secret'); assert.ok(await bcrypt.compare('new-secret', written[0]));
  } finally { db.pool = originalPool; db.isPostgresConnected = originalConnected; }
});

test('saved store selection cannot point at an unassigned store', async () => {
  const originalPool = db.pool, originalConnected = db.isPostgresConnected;
  db.isPostgresConnected = () => true;
  let writes = 0;
  db.pool = { query: async sql => { if (sql.startsWith('INSERT')) writes++; return { rows: [] }; } };
  try {
    const denied = response();
    await controller.put({ path: '/auth/preferences/current_store', params: { section: 'current_store' }, user: { id: 7, role: 'CASHIER' }, body: { store_id: 99 } }, denied);
    assert.equal(denied.statusCode, 403); assert.equal(writes, 0);
  } finally { db.pool = originalPool; db.isPostgresConnected = originalConnected; }
});

test('menu upsert translates correctly to MySQL with repeated payload parameter', () => {
  const query = translate(`INSERT INTO menu_preferences (owner_type,owner_id,section,payload) VALUES ($1,$2,$3,$4)
    ON CONFLICT (owner_type,owner_id,section) DO UPDATE SET payload=$4, updated_at=CURRENT_TIMESTAMP`, ['store', 1, 'speaker', '{}']);
  assert.match(query.statement, /ON DUPLICATE KEY UPDATE payload=\?/);
  assert.deepEqual(query.params, ['store', 1, 'speaker', '{}', '{}']);
});

test('MySQL menu migration preserves existing tables and supports Vietnamese and emoji', () => {
  const sql = schemaFor('mysql');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS menu_preferences/);
  assert.match(sql, /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4/);
  assert.doesNotMatch(sql, /DROP|TRUNCATE|DELETE|INSERT|JSONB|ON CONFLICT/i);
  assert.doesNotMatch(schemaFor('postgres'), /ENGINE=|CHARSET=/);
});

test.after(async () => { await db.pool.end(); });
