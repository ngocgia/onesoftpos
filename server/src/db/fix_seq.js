const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
});
pool.query("SELECT setval(pg_get_serial_sequence('store_types', 'id'), coalesce(max(id), 1)) FROM store_types;")
  .then(() => { console.log('Sequence fixed'); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
