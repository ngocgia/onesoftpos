const { pool, isPostgresConnected, memoryStore } = require('../config/db');

function audit(action, entityType) {
  return (req, res, next) => {
    res.on('finish', async () => {
      if (res.statusCode >= 400 || !req.user) return;
      const storeId = Number(req.storeId || req.body?.store_id) || null;
      const entityId = req.params.id || req.params.itemId || req.body?.code || req.body?.username || null;
      const details = `${req.method} ${req.originalUrl}`;
      const newValue = { ...(req.body || {}) };
      delete newValue.password;
      delete newValue.password_hash;
      try {
        if (isPostgresConnected()) {
          await pool.query(`INSERT INTO audit_logs (store_id,user_id,action,entity_type,entity_id,new_value,details,ip_address)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [storeId, req.user.id, action, entityType, entityId,
            JSON.stringify(newValue), details, req.ip]);
        } else {
          const id = memoryStore.audit_logs.length ? Math.max(...memoryStore.audit_logs.map(log => log.id)) + 1 : 1;
          memoryStore.audit_logs.push({ id, store_id: storeId, user_id: req.user.id, action, entity_type: entityType,
            entity_id: entityId, new_value: newValue, details, ip_address: req.ip, created_at: new Date().toISOString() });
        }
      } catch (error) {
        console.error('Audit log error:', error.message);
      }
    });
    next();
  };
}

module.exports = { audit };
