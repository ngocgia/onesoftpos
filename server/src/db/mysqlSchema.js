const fs = require('fs');
const path = require('path');

// The PostgreSQL schema remains the source of truth for table and column names.
// Convert its CREATE TABLE statements for a fresh MySQL 8 database.
function statements() {
  const source = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const tables = source.match(/CREATE TABLE IF NOT EXISTS [\s\S]*?\n\);/g) || [];
  return tables.map(block => {
    const lines = block.replace(/\r/g, '').split('\n');
    const references = [];
    const converted = lines.map(line => {
      if (!/^\s*\w+\s+/.test(line) || /^\s*(CREATE|PRIMARY|UNIQUE|FOREIGN)\b/i.test(line)) return line;
      const ref = line.match(/^\s*(\w+)\s+[^,]*?\s+REFERENCES\s+(\w+)\((\w+)\)(?:\s+ON DELETE\s+(CASCADE|SET NULL))?/i);
      if (ref) {
        references.push(`    FOREIGN KEY (${ref[1]}) REFERENCES ${ref[2]}(${ref[3]})${ref[4] ? ` ON DELETE ${ref[4]}` : ''}`);
        line = line.replace(/\s+REFERENCES\s+\w+\(\w+\)(?:\s+ON DELETE\s+(?:CASCADE|SET NULL))?/i, '');
      }
      return line;
    });
    let sql = converted.join('\n')
      .replace(/\bSERIAL\b/gi, 'INT AUTO_INCREMENT')
      .replace(/TIMESTAMP WITH TIME ZONE/gi, 'DATETIME')
      .replace(/::jsonb/gi, '')
      .replace(/\bJSONB\b/gi, 'JSON')
      .replace(/\bBOOLEAN\b/gi, 'TINYINT(1)')
      .replace(/\bTRUE\b/gi, '1')
      .replace(/\bFALSE\b/gi, '0');
    // MySQL requires JSON/TEXT defaults to be expressions.
    sql = sql.replace(/(JSON\s+DEFAULT\s+)('(?:[^']|'')*')/gi, '$1($2)');
    sql = sql.replace(/(TEXT\s+DEFAULT\s+)('(?:[^']|'')*')/gi, '$1($2)');
    sql = sql.replace(/\s+--[^\n]*/g, '');
    if (references.length) sql = sql.replace(/\n\);$/, `,\n${references.join(',\n')}\n);`);
    return sql.replace(/;$/, '') + ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
  });
}

module.exports = { statements };
