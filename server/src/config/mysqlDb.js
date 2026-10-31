const { pool, mysqlPool, ensureUtcTimeZone } = require('./mysql');
const { statements } = require('../db/mysqlSchema');
let connected = false;

// (table, column, DDL) pairs mirroring the PostgreSQL boot migrations in
// config/db.js so an older MySQL installation converges on the same schema.
// Types follow the same PostgreSQL -> MySQL rules as ../db/mysqlSchema:
// BOOLEAN -> TINYINT(1), TIMESTAMP WITH TIME ZONE -> DATETIME, JSONB -> JSON
// and TEXT/JSON literal defaults become parenthesized expressions (MySQL 8).
const COLUMN_MIGRATIONS = [
  ['products', 'sort_order', 'INT DEFAULT NULL'],
  ['users', 'completed_items_enabled', 'TINYINT(1) DEFAULT NULL'],
  ['users', 'token_version', 'INT NOT NULL DEFAULT 0'],
  ['order_items', 'variant_id', 'INT DEFAULT NULL'],
  ['product_options', 'group_id', 'INT DEFAULT NULL'],
  ['orders', 'confirmed_by', 'INT DEFAULT NULL'],
  ['orders', 'confirmed_at', 'DATETIME DEFAULT NULL'],
  ['orders', 'fulfillment_type', 'VARCHAR(30) DEFAULT NULL'],
  ['orders', 'delivery_address', 'TEXT'],
  ['orders', 'scheduled_at', 'DATETIME DEFAULT NULL'],
  ['orders', 'workflow_stage_index', 'INT DEFAULT 0'],
  ['orders', 'workflow_snapshot', 'JSON DEFAULT NULL'],
  ['order_items', 'prepared_by', 'INT DEFAULT NULL'],
  ['order_items', 'prepared_at', 'DATETIME DEFAULT NULL'],
  ['order_items', 'cancelled_by', 'INT DEFAULT NULL'],
  ['order_items', 'cancelled_at', 'DATETIME DEFAULT NULL'],
  ['store_settings', 'kds_completion_message', "TEXT DEFAULT ('Món ăn {mon}, bàn {ban} đã xong')"],
  ['store_settings', 'takeaway_workspace_enabled', 'TINYINT(1) DEFAULT NULL'],
  ['store_settings', 'product_modifier_popup_enabled', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ['store_settings', 'workflow_definition', `JSON DEFAULT ('{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}')`],
  ['store_settings', 'admin_tabs', 'JSON DEFAULT NULL'],
  ['store_settings', 'inventory_transactions_enabled', 'TINYINT(1) DEFAULT 1']
];

// Full role x feature matrix, identical to seed.sql. Missing rows deny access
// since requireFeature/getRoleFeatures became fail-closed; INSERT IGNORE only
// backfills gaps and never overwrites a customized value.
const ROLE_FEATURE_MATRIX = [
  // ADMIN: full access (seed.sql seeds every ADMIN feature enabled).
  ['ADMIN', 'POS', true], ['ADMIN', 'TABLES', true], ['ADMIN', 'KDS', true], ['ADMIN', 'ORDERS', true],
  ['ADMIN', 'HISTORY', true], ['ADMIN', 'PAYMENT', true], ['ADMIN', 'ADMIN', true], ['ADMIN', 'SHIFT', true],
  ['ADMIN', 'DISCOUNT', true], ['ADMIN', 'COMPLETED_ITEMS', true], ['ADMIN', 'INVENTORY', true],
  // STORE_MANAGER: full access (seed.sql seeds every STORE_MANAGER feature enabled).
  ['STORE_MANAGER', 'POS', true], ['STORE_MANAGER', 'TABLES', true], ['STORE_MANAGER', 'KDS', true], ['STORE_MANAGER', 'ORDERS', true],
  ['STORE_MANAGER', 'HISTORY', true], ['STORE_MANAGER', 'PAYMENT', true], ['STORE_MANAGER', 'ADMIN', true], ['STORE_MANAGER', 'SHIFT', true],
  ['STORE_MANAGER', 'DISCOUNT', true], ['STORE_MANAGER', 'COMPLETED_ITEMS', true], ['STORE_MANAGER', 'INVENTORY', true],
  // CASHIER: no KDS, no ADMIN, no INVENTORY (seed.sql rows).
  ['CASHIER', 'POS', true], ['CASHIER', 'TABLES', true], ['CASHIER', 'KDS', false], ['CASHIER', 'ORDERS', true],
  ['CASHIER', 'HISTORY', true], ['CASHIER', 'PAYMENT', true], ['CASHIER', 'ADMIN', false], ['CASHIER', 'SHIFT', true],
  ['CASHIER', 'DISCOUNT', true], ['CASHIER', 'COMPLETED_ITEMS', true], ['CASHIER', 'INVENTORY', false],
  // KITCHEN: KDS/HISTORY only (seed.sql rows).
  ['KITCHEN', 'POS', false], ['KITCHEN', 'TABLES', false], ['KITCHEN', 'KDS', true], ['KITCHEN', 'ORDERS', false],
  ['KITCHEN', 'HISTORY', true], ['KITCHEN', 'PAYMENT', false], ['KITCHEN', 'ADMIN', false], ['KITCHEN', 'SHIFT', false],
  ['KITCHEN', 'DISCOUNT', false], ['KITCHEN', 'COMPLETED_ITEMS', false], ['KITCHEN', 'INVENTORY', false],
  // ORDER_STAFF: POS/TABLES/ORDERS/HISTORY/COMPLETED_ITEMS only (seed.sql rows).
  ['ORDER_STAFF', 'POS', true], ['ORDER_STAFF', 'TABLES', true], ['ORDER_STAFF', 'KDS', false], ['ORDER_STAFF', 'ORDERS', true],
  ['ORDER_STAFF', 'HISTORY', true], ['ORDER_STAFF', 'PAYMENT', false], ['ORDER_STAFF', 'ADMIN', false], ['ORDER_STAFF', 'SHIFT', false],
  ['ORDER_STAFF', 'DISCOUNT', false], ['ORDER_STAFF', 'COMPLETED_ITEMS', true], ['ORDER_STAFF', 'INVENTORY', false]
];

async function ensureTables(connection) {
  // CREATE TABLE IF NOT EXISTS only creates what is missing; statements()
  // already returns the MySQL dialect conversion (including inventory_items,
  // inventory_transactions, topping_groups, product_option_products...).
  for (const sql of statements()) {
    if (/^CREATE TABLE IF NOT EXISTS /i.test(sql)) await connection.query(sql);
  }
}

async function ensureColumns(connection) {
  const columnsByTable = new Map();
  for (const [table, column, ddl] of COLUMN_MIGRATIONS) {
    if (!columnsByTable.has(table)) columnsByTable.set(table, []);
    columnsByTable.get(table).push([column, ddl]);
  }
  for (const [table, columns] of columnsByTable) {
    const [rows] = await connection.query(
      'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table]
    );
    const known = new Set(rows.map(row => row.name));
    for (const [column, ddl] of columns) {
      if (known.has(column)) continue;
      try {
        await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
      } catch (error) {
        // Another server instance may have added the column concurrently.
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }
  }
}

async function ensureRoleFeatures(connection) {
  const placeholders = ROLE_FEATURE_MATRIX.map(() => '(?, ?, ?)').join(', ');
  await connection.query(
    `INSERT IGNORE INTO role_features (role, feature_code, enabled) VALUES ${placeholders}`,
    ROLE_FEATURE_MATRIX.flat()
  );
}

async function ensureSchemaUpgrades() {
  const connection = await mysqlPool.getConnection();
  try {
    // DDL and backfill statements are already MySQL SQL: run them on the raw
    // connection so the PG->MySQL wrapper never translates them.
    await ensureUtcTimeZone(connection);
    await ensureTables(connection);
    await ensureColumns(connection);

    // Mirror the PostgreSQL boot migrations: add schema indexes older
    // installations are missing (MySQL has no CREATE INDEX IF NOT EXISTS).
    const [indexRows] = await connection.query("SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()");
    const knownIndexes = new Set(indexRows.map(row => row.name));
    for (const sql of statements()) {
      if (!/^CREATE (?:UNIQUE )?INDEX /i.test(sql)) continue;
      const name = sql.match(/^CREATE (?:UNIQUE )?INDEX (\w+) ON/i)[1];
      if (!knownIndexes.has(name)) await connection.query(sql);
    }
    for (const sql of [
      'ALTER TABLE product_variants ADD CONSTRAINT uq_product_variants_product_size UNIQUE (product_id, size_name)',
      'ALTER TABLE product_options ADD CONSTRAINT uq_product_options_store_group_name UNIQUE (store_id, group_id, name)'
    ]) {
      try {
        await connection.query(sql);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          // Legacy duplicate rows exist; clean them up manually, then restart.
          console.warn('[MySQL] Skipped unique constraint (duplicate rows present):', error.message);
        } else if (error.code !== 'ER_DUP_KEYNAME') {
          throw error;
        }
      }
    }
    await ensureRoleFeatures(connection);
  } finally {
    connection.release();
  }
}

async function testConnection() {
  try {
    await pool.query('SELECT 1 FROM users LIMIT 1');
    await ensureSchemaUpgrades();
    connected = true;
    console.log('[MySQL] Connected successfully.');
    return true;
  } catch (error) {
    connected = false;
    console.error('[MySQL] Connection or schema failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  query: (...args) => connected ? pool.query(...args) : null,
  testConnection,
  // Existing controllers use this name as a database availability flag.
  isPostgresConnected: () => connected,
  memoryStore: {},
};
