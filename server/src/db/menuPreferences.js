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
    ? schema.replace('payload TEXT', 'payload MEDIUMTEXT').replace(/;$/, ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;')
    : schema;
}

async function ensureMenuPreferences(pool, client = process.env.DB_CLIENT) {
  await pool.query(schemaFor(client));
  if (client === 'mysql') {
    const result = await pool.query("SELECT DATA_TYPE AS data_type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='menu_preferences' AND COLUMN_NAME='payload'");
    if (['tinytext', 'text'].includes(result.rows[0]?.data_type)) {
      await pool.query('ALTER TABLE menu_preferences MODIFY COLUMN payload MEDIUMTEXT NOT NULL');
    }
  }
}
module.exports = { schema, schemaFor, ensureMenuPreferences };
