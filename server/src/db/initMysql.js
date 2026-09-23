const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { mysqlPool } = require('../config/mysql');
const { statements } = require('./mysqlSchema');

function seedStatements() {
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8')
    .replace(/^--.*$/gm, '')
    .replace(/::jsonb/gi, '');
  return seed.split(';').map(part => part.trim())
    .filter(sql => /^INSERT\s+INTO\b/i.test(sql))
    .map(sql => sql.replace(/\s+ON CONFLICT[\s\S]*$/i, ''));
}

async function initMysql() {
  const connection = await mysqlPool.getConnection();
  try {
    for (const sql of statements()) await connection.query(sql);
    const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM stores');
    if (count) {
      console.log('MySQL schema ready; existing data was left intact.');
      return;
    }
    await connection.beginTransaction();
    try {
      for (const sql of seedStatements()) await connection.query(sql);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    console.log('MySQL schema and sample data initialized.');
  } finally {
    connection.release();
    await mysqlPool.end();
  }
}

if (require.main === module) {
  initMysql().catch(error => { console.error('MySQL initialization failed:', error); process.exitCode = 1; });
}

module.exports = initMysql;
module.exports.seedStatements = seedStatements;
