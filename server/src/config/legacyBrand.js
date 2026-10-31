// Compatibility identifiers are not branding. Changing this default would
// disconnect existing PostgreSQL installations.
// New installations should set PGDATABASE explicitly; JWT_SECRET is required
// and validated at startup in server.js.
module.exports = {
  LEGACY_DATABASE_NAME: 'thichgapos'
};
