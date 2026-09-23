require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
if (process.env.DB_CLIENT === 'mysql') {
  require('./initMysql')().catch(error => { console.error('MySQL initialization failed:', error); process.exitCode = 1; });
} else {
  require('./initDb');
}
