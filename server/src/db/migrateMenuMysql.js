const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
  if (process.env.DB_CLIENT !== 'mysql') throw new Error('Đặt DB_CLIENT=mysql trong server/.env trước khi chạy migration MySQL.');
  const { pool } = require('../config/mysql');
  const { ensureMenuPreferences } = require('./menuPreferences');
  try {
    await ensureMenuPreferences(pool, 'mysql');
    console.log('MySQL: menu_preferences đã sẵn sàng. Dữ liệu hiện có được giữ nguyên.');
  } finally { await pool.end(); }
}

if (require.main === module) migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = migrate;
