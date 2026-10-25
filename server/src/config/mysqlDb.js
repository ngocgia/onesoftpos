const { pool } = require('./mysql');
let connected = false;

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
