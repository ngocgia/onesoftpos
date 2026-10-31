const { pool } = require('./mysql');
const { statements } = require('../db/mysqlSchema');
let connected = false;

async function ensureSchemaUpgrades() {
  // Mirror the PostgreSQL boot migrations: add schema indexes that older
  // installations are missing (MySQL has no CREATE INDEX IF NOT EXISTS).
  const indexStatements = statements().filter(sql => /^CREATE (?:UNIQUE )?INDEX /i.test(sql));
  if (indexStatements.length) {
    const existing = await pool.query("SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()");
    const known = new Set(existing.rows.map(row => row.name));
    for (const sql of indexStatements) {
      const name = sql.match(/^CREATE (?:UNIQUE )?INDEX (\w+) ON/i)[1];
      if (!known.has(name)) await pool.query(sql);
    }
  }
  for (const sql of [
    'ALTER TABLE product_variants ADD CONSTRAINT uq_product_variants_product_size UNIQUE (product_id, size_name)',
    'ALTER TABLE product_options ADD CONSTRAINT uq_product_options_store_group_name UNIQUE (store_id, group_id, name)'
  ]) {
    try {
      await pool.query(sql);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        // Legacy duplicate rows exist; clean them up manually, then restart.
        console.warn('[MySQL] Skipped unique constraint (duplicate rows present):', error.message);
      } else if (error.code !== 'ER_DUP_KEYNAME') {
        throw error;
      }
    }
  }
}

async function testConnection() {
  try {
    await pool.query('SELECT 1 FROM users LIMIT 1');
    const columns = await pool.query("SHOW COLUMNS FROM store_settings LIKE 'product_modifier_popup_enabled'");
    if (!columns.rows.length) {
      try {
        await pool.query('ALTER TABLE store_settings ADD COLUMN product_modifier_popup_enabled TINYINT(1) NOT NULL DEFAULT 1');
      } catch (error) {
        // Another server instance may have added the column concurrently.
        if (error.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }
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
