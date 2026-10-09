const test = require('node:test');
const assert = require('node:assert/strict');
const { translate, run, mysqlPool, normalizeError } = require('../src/config/mysql');
const { statements } = require('../src/db/mysqlSchema');
const { seedStatements } = require('../src/db/initMysql');

test('converts numbered parameters, repeated parameters, arrays, and PostgreSQL casts', () => {
  const query = translate('SELECT * FROM products WHERE store_id=$1 AND id=ANY($2::int[]) AND store_id=$1', [3, [7, 8]]);
  assert.equal(query.statement, 'SELECT * FROM products WHERE store_id=? AND id IN (?,?) AND store_id=?');
  assert.deepEqual(query.params, [3, 7, 8, 3]);
});

test('converts conflict clauses and captures returning columns', () => {
  assert.equal(translate('INSERT INTO role_features (role,enabled) VALUES ($1,$2) ON CONFLICT (role) DO UPDATE SET enabled=$2', ['A', true]).statement,
    'INSERT INTO role_features (role,enabled) VALUES (?,?) ON DUPLICATE KEY UPDATE enabled=?');
  assert.equal(translate('INSERT INTO user_stores (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [1]).statement,
    'INSERT IGNORE INTO user_stores (user_id) VALUES (?) ');
  assert.equal(translate('INSERT INTO areas (name) VALUES ($1) RETURNING *', ['A']).returning, '*');
});

test('emulates INSERT RETURNING on the same connection', async () => {
  const calls = [];
  const connection = { query: async (sql, params) => {
    calls.push([sql, params]);
    if (sql.startsWith('INSERT')) return [{ insertId: 12, affectedRows: 1 }, []];
    return [[{ id: 12, name: 'A' }], []];
  } };
  const result = await run(connection, 'INSERT INTO areas (name) VALUES ($1) RETURNING *', ['A']);
  assert.deepEqual(result.rows, [{ id: 12, name: 'A' }]);
  assert.deepEqual(calls[1], ['SELECT * FROM areas WHERE id=?', [12]]);
});

test('returns matched UPDATE rows even when values are unchanged', async () => {
  const connection = { query: async sql => sql.startsWith('UPDATE')
    ? [{ affectedRows: 0 }, []]
    : [[{ id: 4, name: 'Same' }], []] };
  const result = await run(connection, 'UPDATE areas SET name=$1 WHERE id=$2 RETURNING *', ['Same', 4]);
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0].id, 4);
});

test('converts date intervals and case insensitive search', () => {
  const query = translate("SELECT * FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND name ILIKE $1", ['A%']);
  assert.equal(query.statement, 'SELECT * FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL 7 DAY AND name LIKE ?');
});

test('converts PostgreSQL date, null ordering, and distinct comparisons', () => {
  assert.equal(
    translate("SELECT * FROM orders WHERE created_at >= date_trunc('month', CURRENT_DATE)").statement,
    "SELECT * FROM orders WHERE created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')"
  );
  assert.equal(
    translate("SELECT * FROM orders WHERE payment_status IS DISTINCT FROM 'PAID' ORDER BY prepared_at DESC NULLS LAST").statement,
    "SELECT * FROM orders WHERE NOT (payment_status <=> 'PAID') ORDER BY prepared_at DESC"
  );
  assert.equal(
    translate('SELECT * FROM orders ORDER BY prepared_at ASC NULLS LAST').statement,
    'SELECT * FROM orders ORDER BY prepared_at IS NULL, prepared_at ASC'
  );
});

test('normalizes common MySQL constraint errors for existing controllers', () => {
  assert.equal(normalizeError({ code: 'ER_DUP_ENTRY' }).code, '23505');
  assert.equal(normalizeError({ code: 'ER_ROW_IS_REFERENCED_2' }).code, '23503');
  assert.equal(normalizeError({ code: 'ER_BAD_NULL_ERROR' }).code, '23502');
});

test('generates a MySQL schema and clean seed for the fresh database', () => {
  const schema = statements();
  const seed = seedStatements();
  assert.equal(schema.length, 26);
  assert.ok(schema.some(sql => sql.includes("CREATE TABLE IF NOT EXISTS menu_preferences")));
  assert.ok(seed.length > 10);
  assert.ok(schema.every(sql => !/SERIAL|JSONB|TIMESTAMP WITH TIME ZONE|::jsonb/.test(sql)));
  assert.ok(seed.every(sql => /^INSERT INTO/.test(sql) && !/ON CONFLICT|setval|::jsonb/.test(sql)));
});

test.after(async () => { await mysqlPool.end(); });
