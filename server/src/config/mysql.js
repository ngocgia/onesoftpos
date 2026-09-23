const mysql = require('mysql2/promise');

const options = {
  ...(process.env.MYSQL_SOCKET_PATH ? { socketPath: process.env.MYSQL_SOCKET_PATH } : {}),
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

const mysqlPool = mysql.createPool({ ...options, waitForConnections: true, connectionLimit: 10, decimalNumbers: true, timezone: 'Z' });

function translate(sql, values = []) {
  let statement = sql.trim();
  let params = [];
  const returning = statement.match(/\s+RETURNING\s+([\s\S]+)$/i);
  if (returning) statement = statement.slice(0, returning.index);
  statement = statement.replace(/\bFOR UPDATE OF\s+\w+(?:\s*,\s*\w+)*/gi, 'FOR UPDATE');
  statement = statement.replace(/\bILIKE\b/gi, 'LIKE');
  statement = statement.replace(/\b([\w.]+)\s+IS\s+NOT\s+DISTINCT\s+FROM\s+([^\s,)]+)/gi, '($1 <=> $2)');
  statement = statement.replace(/\b([\w.]+)\s+IS\s+DISTINCT\s+FROM\s+([^\s,)]+)/gi, 'NOT ($1 <=> $2)');
  // MySQL sorts NULL before non-NULL in ascending order and after them in
  // descending order. Expand PostgreSQL's explicit NULL ordering where the
  // defaults differ, and remove it where the defaults already match.
  statement = statement.replace(/([\w.]+)\s+ASC\s+NULLS\s+LAST/gi, '$1 IS NULL, $1 ASC');
  statement = statement.replace(/([\w.]+)\s+DESC\s+NULLS\s+FIRST/gi, '$1 IS NOT NULL, $1 DESC');
  statement = statement.replace(/\s+NULLS\s+(?:FIRST|LAST)/gi, '');
  statement = statement.replace(/::(?:int|varchar|boolean|jsonb)(?:\[\])?/gi, '');
  statement = statement.replace(/COUNT\(([^)]*)\)::int/gi, 'COUNT($1)');
  statement = statement.replace(/CURRENT_DATE\s*-\s*INTERVAL\s*'(\d+) days'/gi, 'CURRENT_DATE - INTERVAL $1 DAY');
  statement = statement.replace(/date_trunc\(\s*'month'\s*,\s*CURRENT_DATE\s*\)/gi, "DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')");
  if (/\bON CONFLICT\s*(?:\([^)]*\))?\s*DO NOTHING/i.test(statement)) {
    statement = statement.replace(/\bON CONFLICT\s*(?:\([^)]*\))?\s*DO NOTHING/gi, '');
    statement = statement.replace(/^INSERT\s+INTO/i, 'INSERT IGNORE INTO');
  }
  statement = statement.replace(/\bON CONFLICT\s*\([^)]*\)\s*DO UPDATE SET/gi, 'ON DUPLICATE KEY UPDATE');
  statement = statement.replace(/\bEXCLUDED\.(\w+)/gi, 'VALUES($1)');
  statement = statement.replace(/=\s*ANY\(\$(\d+)\)/gi, (_, n) => {
    const list = values[Number(n) - 1];
    if (!Array.isArray(list)) throw new Error('ANY parameter must be an array');
    return ` IN (${list.map(() => `$${n}`).join(',') || 'NULL'})`;
  });
  const usage = new Map();
  statement = statement.replace(/\$(\d+)/g, (_, raw) => {
    const index = Number(raw) - 1;
    const value = values[index];
    if (Array.isArray(value)) {
      const used = usage.get(index) || 0;
      usage.set(index, used + 1);
      params.push(value[used] === undefined ? null : value[used]);
    } else {
      params.push(value === undefined ? null : value && typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : value);
    }
    return '?';
  });
  return { statement, params, returning: returning?.[1]?.trim() };
}

function normalizeError(error) {
  if (error?.code === 'ER_DUP_ENTRY') error.code = '23505';
  if (error?.code === 'ER_NO_REFERENCED_ROW_2' || error?.code === 'ER_ROW_IS_REFERENCED_2') error.code = '23503';
  if (error?.code === 'ER_BAD_NULL_ERROR') error.code = '23502';
  return error;
}

function normalizeRows(rows, fields = []) {
  const booleans = new Set(fields.filter(field => field.columnType === 1 && field.columnLength === 1).map(field => field.name));
  return rows.map(row => {
    for (const [key, value] of Object.entries(row)) {
      if (booleans.has(key) && value !== null) row[key] = Boolean(value);
      if (Buffer.isBuffer(value) && value.length === 1) row[key] = value[0];
      if (typeof value === 'string' && (key === 'workflow_definition' || key === 'workflow_snapshot' || key === 'admin_tabs')) {
        try { row[key] = JSON.parse(value); } catch (_) { /* Keep legacy text. */ }
      }
    }
    return row;
  });
}

async function run(connection, sql, values) {
  const { statement, params, returning } = translate(sql, values);
  const kind = statement.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)/i)?.[1]?.toUpperCase();
  if (kind === 'BEGIN') { await connection.beginTransaction(); return { rows: [], rowCount: 0 }; }
  if (kind === 'COMMIT') { await connection.commit(); return { rows: [], rowCount: 0 }; }
  if (kind === 'ROLLBACK') { await connection.rollback(); return { rows: [], rowCount: 0 }; }

  let previous = [];
  let previousFields = [];
  if (returning && kind === 'DELETE') {
    const table = statement.match(/^DELETE\s+FROM\s+(\w+)/i)?.[1];
    const where = statement.match(/\bWHERE\s+([\s\S]+)$/i)?.[1];
    if (table && where) {
      const [rows, fields] = await connection.query(`SELECT * FROM ${table} WHERE ${where}`, params);
      previous = rows;
      previousFields = fields;
    }
  }
  let result;
  let fields;
  try {
    [result, fields] = await connection.query(statement, params);
  } catch (error) {
    throw normalizeError(error);
  }
  if (Array.isArray(result)) return { rows: normalizeRows(result, fields), rowCount: result.length };
  let rows = [];
  let returnedFields = [];
  if (returning && (result.affectedRows || kind === 'UPDATE')) {
    if (kind === 'INSERT') {
      const table = statement.match(/^INSERT\s+INTO\s+(\w+)/i)?.[1];
      if (table) [rows, returnedFields] = await connection.query(`SELECT * FROM ${table} WHERE id=?`, [result.insertId]);
    } else if (kind === 'UPDATE') {
      const table = statement.match(/^UPDATE\s+(\w+)/i)?.[1];
      const where = statement.match(/\bWHERE\s+([\s\S]+)$/i)?.[1];
      if (table && where) [rows, returnedFields] = await connection.query(`SELECT * FROM ${table} WHERE ${where}`, params.slice(-((where.match(/\?/g) || []).length)));
    } else if (kind === 'DELETE') { rows = previous; returnedFields = previousFields; }
  }
  return { rows: normalizeRows(rows, returnedFields), rowCount: kind === 'UPDATE' && returning ? rows.length : result.affectedRows || 0 };
}

const pool = {
  async query(sql, values) {
    const connection = await mysqlPool.getConnection();
    try { return await run(connection, sql, values); } finally { connection.release(); }
  },
  async connect() {
    const connection = await mysqlPool.getConnection();
    return { query: (sql, values) => run(connection, sql, values), release: () => connection.release() };
  },
  end: () => mysqlPool.end(),
};

module.exports = { pool, mysqlPool, translate, run, normalizeError };
