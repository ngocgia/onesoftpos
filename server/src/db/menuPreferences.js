const schema = `CREATE TABLE IF NOT EXISTS menu_preferences (
    owner_type VARCHAR(10) NOT NULL,
    owner_id INTEGER NOT NULL,
    section VARCHAR(32) NOT NULL,
    payload TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_type, owner_id, section)
);`;

function schemaFor(client = process.env.DB_CLIENT) {
  return client === 'mysql'
    ? schema.replace(/;$/, ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;')
    : schema;
}

async function ensureMenuPreferences(pool) {
  await pool.query(schemaFor());
}
module.exports = { schema, schemaFor, ensureMenuPreferences };
