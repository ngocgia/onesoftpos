const jwt = require('jsonwebtoken');
const { pool, isPostgresConnected, memoryStore } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'thichgapos_jwt_secret_key_2026_production';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Check store context
    const requestedStoreId = req.headers['x-store-id'] || req.query.store_id || (req.body && req.body.store_id);
    if (requestedStoreId) {
      req.storeId = parseInt(requestedStoreId, 10);
      
      // Multi-store authorization check
      // Super Admin and Admin have access to all stores. Other roles must belong to the store.
      if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
        let hasAccess = false;
        if (isPostgresConnected()) {
          const check = await pool.query(
            'SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = $2',
            [req.user.id, req.storeId]
          );
          hasAccess = check.rows.length > 0;
        } else {
          hasAccess = memoryStore.user_stores.some(
            us => us.user_id === req.user.id && us.store_id === req.storeId
          );
        }

        if (!hasAccess) {
          return res.status(403).json({ 
            success: false, 
            message: 'Bạn không có quyền truy cập dữ liệu của cửa hàng này' 
          });
        }
      }
    }

    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Phiên làm việc hết hạn hoặc không hợp lệ' });
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực danh tính' });
    }
    if (req.user.role === 'SUPER_ADMIN') {
      return next(); // Super admin bypass
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Bạn không có đủ quyền thực hiện hành động này' 
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  JWT_SECRET
};
