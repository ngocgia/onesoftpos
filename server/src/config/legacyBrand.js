// Compatibility identifiers are not branding. Changing these defaults would
// disconnect existing PostgreSQL installations or invalidate active logins.
// New installations should set PGDATABASE and JWT_SECRET explicitly.
module.exports = {
  LEGACY_DATABASE_NAME: 'thichgapos',
  LEGACY_JWT_SECRET: 'thichgapos_jwt_secret_key_2026_production'
};
