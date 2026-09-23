const fs = require('fs');
const path = require('path');
const { statements } = require('./mysqlSchema');
const { seedStatements } = require('./initMysql');

const output = path.join(__dirname, 'mysql-import.sql');
const sql = '-- Import this into an EMPTY MySQL 8 database using phpMyAdmin.\n' +
  '-- Sample accounts are created with the password from seed.sql; change them before production use.\n\n' +
  ['SET NAMES utf8mb4', ...statements(), ...seedStatements()].join(';\n\n') + ';\n';
fs.writeFileSync(output, sql, 'utf8');
console.log(`Wrote ${output}`);
