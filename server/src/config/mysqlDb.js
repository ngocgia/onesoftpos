const { pool } = require('./mysql');
let connected = false;

async function testConnection() {
  try {
    await pool.query('SELECT 1 FROM users LIMIT 1');
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
