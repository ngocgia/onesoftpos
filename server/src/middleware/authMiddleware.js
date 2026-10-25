const { LEGACY_JWT_SECRET } = require('../config/legacyBrand');
const jwt = require('jsonwebtoken');
const { pool, isPostgresConnected, memoryStore } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || LEGACY_JWT_SECRET;

async function userCanAccessStore(user, storeId) {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (!Number.isInteger(storeId) || storeId <= 0) return false;

  if (isPostgresConnected()) {
    const check = await pool.query(
      'SELECT 1 FROM user_stores WHERE user_id = $1 AND store_id = $2',
      [user.id, storeId]
    );
    return check.rows.length > 0;
  }

  return memoryStore.user_stores.some(
    us => us.user_id === user.id && us.store_id === storeId
  );
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let currentUser;
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT id,username,email,full_name,role,status FROM users WHERE id=$1', [decoded.id]);
      currentUser = result.rows[0];
    } else {
      currentUser = memoryStore.users.find(user => user.id === decoded.id);
    }
    if (!currentUser || currentUser.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa hoặc không còn tồn tại' });
    }
    req.user = { ...decoded, ...currentUser };

    // Check store context
    const requestedStoreId = req.headers['x-store-id'] || req.query.store_id || (req.body && req.body.store_id);
    if (requestedStoreId) {
      req.storeId = parseInt(requestedStoreId, 10);
      
      // Multi-store authorization check
      // Super Admin and Admin have access to all stores. Other roles must belong to the store.
      if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
        if (!(await userCanAccessStore(req.user, req.storeId))) {
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

function requireStoreAccess(paramName = 'id') {
  return async (req, res, next) => {
    try {
      const storeId = Number(req.params[paramName]);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({ success: false, message: 'Mã cửa hàng không hợp lệ' });
      }
      if (!(await userCanAccessStore(req.user, storeId))) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ được quản lý cửa hàng đã được phân công'
        });
      }
      req.storeId = storeId;
      next();
    } catch (error) {
      console.error('requireStoreAccess error:', error);
      res.status(500).json({ success: false, message: 'Không thể kiểm tra quyền cửa hàng' });
    }
  };
}

function requireStoreContext() {
  return async (req, res, next) => {
    try {
      const storeId = Number(req.storeId || req.headers['x-store-id'] || req.query.store_id || req.body?.store_id);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn cửa hàng' });
      }
      if (!(await userCanAccessStore(req.user, storeId))) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền quản lý cửa hàng này' });
      }
      req.storeId = storeId;
      next();
    } catch (error) {
      console.error('requireStoreContext error:', error);
      res.status(500).json({ success: false, message: 'Không thể kiểm tra quyền cửa hàng' });
    }
  };
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

function requireFeature(featureCode) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Chưa xác thực danh tính' });
    if (req.user.role === 'SUPER_ADMIN') return next();
    try {
      let setting;
      let userOverride;
      if (isPostgresConnected()) {
        if (featureCode === 'COMPLETED_ITEMS') {
          const overrideResult = await pool.query('SELECT completed_items_enabled FROM users WHERE id=$1', [req.user.id]);
          userOverride = overrideResult.rows[0]?.completed_items_enabled;
        }
        const result = req.storeId
          ? await pool.query(`SELECT enabled FROM store_role_features WHERE store_id=$1 AND role=$2 AND feature_code=$3
              UNION ALL SELECT enabled FROM role_features WHERE role=$2 AND feature_code=$3
              AND NOT EXISTS (SELECT 1 FROM store_role_features WHERE store_id=$1 AND role=$2 AND feature_code=$3)
              LIMIT 1`, [req.storeId, req.user.role, featureCode])
          : await pool.query('SELECT enabled FROM role_features WHERE role = $1 AND feature_code = $2', [req.user.role, featureCode]);
        setting = result.rows[0];
      } else {
        if (featureCode === 'COMPLETED_ITEMS') {
          userOverride = memoryStore.users.find(item => item.id === req.user.id)?.completed_items_enabled;
        }
        setting = memoryStore.store_role_features.find(item => item.store_id === req.storeId && item.role === req.user.role && item.feature_code === featureCode)
          || memoryStore.role_features.find(item => item.role === req.user.role && item.feature_code === featureCode);
      }
      if (typeof userOverride === 'boolean') setting = { enabled: userOverride };
      if (setting && !setting.enabled) {
        return res.status(403).json({ success: false, message: 'Nhóm người dùng của bạn không được cấp chức năng này' });
      }
      next();
    } catch (error) {
      console.error('requireFeature error:', error);
      res.status(500).json({ success: false, message: 'Không thể kiểm tra quyền chức năng' });
    }
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  requireFeature,
  requireStoreAccess,
  requireStoreContext,
  JWT_SECRET
};
