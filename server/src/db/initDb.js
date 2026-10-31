const { LEGACY_DATABASE_NAME } = require('../config/legacyBrand');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL || 
  `postgres://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || LEGACY_DATABASE_NAME}`;

console.log('Connecting to PostgreSQL to initialize database...');
console.log('Connection URL:', connectionString.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
  connectionString: connectionString,
  connectionTimeoutMillis: 5000
});

async function initDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Schema and seed run inside ONE transaction so the database is either
    // fully initialized or left untouched, never half-way. Every statement in
    // both files (CREATE/ALTER ... IF NOT EXISTS, CREATE INDEX, INSERT ...
    // ON CONFLICT, setval) is transaction-safe in PostgreSQL.
    await client.query('BEGIN');
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      console.log('Executing schema.sql...');
      await client.query(schemaSql);
      console.log('Schema created successfully.');

      const seedPath = path.join(__dirname, 'seed.sql');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      console.log('Executing seed.sql...');
      await client.query(seedSql);
      console.log('Seed data inserted successfully.');

      await client.query('COMMIT');
      console.log('Database initialization complete!');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // The connection may already be unusable; the original error matters more.
        console.error('Rollback failed:', rollbackError.message);
      }
      throw error;
    }
  } catch (error) {
    // Fail the process (non-zero exit) instead of silently exiting with 0.
    process.exitCode = 1;
    console.error('Error during database initialization:', error.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

initDatabase();
