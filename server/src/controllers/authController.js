const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool, isPostgresConnected, memoryStore } = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const DEFAULT_ROLE_FEATURES = ['POS', 'TABLES', 'KDS', 'ORDERS', 'HISTORY', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT', 'COMPLETED_ITEMS'];

async function getRoleFeatures(role, storeId = null, userId = null) {
  if (role === 'SUPER_ADMIN') {
    return Object.fromEntries(DEFAULT_ROLE_FEATURES.map(code => [code, true]));
  }
  let rows;
  if (isPostgresConnected()) {
    const result = storeId
      ? await pool.query(`SELECT base.feature_code, COALESCE(local.enabled, base.enabled) AS enabled
          FROM role_features base LEFT JOIN store_role_features local
          ON local.store_id=$2 AND local.role=base.role AND local.feature_code=base.feature_code
          WHERE base.role=$1`, [role, storeId])
      : await pool.query('SELECT feature_code, enabled FROM role_features WHERE role = $1', [role]);
    rows = result.rows;
  } else {
    rows = memoryStore.role_features.filter(item => item.role === role).map(item => {
      const local = storeId && memoryStore.store_role_features.find(override => override.store_id === storeId && override.role === role && override.feature_code === item.feature_code);
      return local || item;
    });
  }
  const features = Object.fromEntries(DEFAULT_ROLE_FEATURES.map(code => {
    const found = rows.find(item => item.feature_code === code);
    return [code, found ? !!found.enabled : true];
  }));
  let completedItemsOverride;
  if (userId && isPostgresConnected()) {
    const result = await pool.query('SELECT completed_items_enabled FROM users WHERE id=$1', [userId]);
    completedItemsOverride = result.rows[0]?.completed_items_enabled;
  } else if (userId) {
    completedItemsOverride = memoryStore.users.find(item => item.id === userId)?.completed_items_enabled;
  }
  if (typeof completedItemsOverride === 'boolean') features.COMPLETED_ITEMS = completedItemsOverride;
  return features;
}

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
  }

  try {
    let user = null;
    if (isPostgresConnected()) {
      const result = await pool.query(
        'SELECT * FROM users WHERE (username = $1 OR email = $1) AND status = $2',
        [username, 'ACTIVE']
      );
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    } else {
      user = memoryStore.users.find(
        u => (u.username === username || u.email === username) && u.status === 'ACTIVE'
      );
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    // Only bcrypt-verifiable passwords are accepted; an account without a
    // password_hash cannot log in until an admin sets one.
    let isMatch = false;
    if (user.password_hash) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    // Get accessible stores
    let stores = [];
    if (isPostgresConnected()) {
      if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        const storeRes = await pool.query(
          `SELECT s.*, st.code as store_type_code, st.name as store_type_name 
           FROM stores s 
           LEFT JOIN store_types st ON s.store_type_id = st.id 
           WHERE s.status = 'ACTIVE' ORDER BY s.id ASC`
        );
        stores = storeRes.rows;
      } else {
        const storeRes = await pool.query(
          `SELECT s.*, st.code as store_type_code, st.name as store_type_name, us.is_default 
           FROM stores s 
           JOIN user_stores us ON s.id = us.store_id 
           LEFT JOIN store_types st ON s.store_type_id = st.id 
           WHERE us.user_id = $1 AND s.status = 'ACTIVE' ORDER BY s.id ASC`,
          [user.id]
        );
        stores = storeRes.rows;
      }
    } else {
      if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        stores = memoryStore.stores.filter(s => s.status === 'ACTIVE');
      } else {
        const userStoreIds = memoryStore.user_stores
          .filter(us => us.user_id === user.id)
          .map(us => us.store_id);
        stores = memoryStore.stores.filter(s => userStoreIds.includes(s.id) && s.status === 'ACTIVE');
      }
    }

    const defaultStore = stores.find(s => s.is_default) || stores[0] || null;
    const roleFeatures = await getRoleFeatures(user.role, defaultStore?.id, user.id);

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      stores,
      defaultStore,
      roleFeatures
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập' });
  }
}

async function getMe(req, res) {
  try {
    const user = req.user;
    let stores = [];

    if (isPostgresConnected()) {
      if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        const storeRes = await pool.query(
          `SELECT s.*, st.code as store_type_code, st.name as store_type_name 
           FROM stores s 
           LEFT JOIN store_types st ON s.store_type_id = st.id 
           WHERE s.status = 'ACTIVE' ORDER BY s.id ASC`
        );
        stores = storeRes.rows;
      } else {
        const storeRes = await pool.query(
          `SELECT s.*, st.code as store_type_code, st.name as store_type_name, us.is_default 
           FROM stores s 
           JOIN user_stores us ON s.id = us.store_id 
           LEFT JOIN store_types st ON s.store_type_id = st.id 
           WHERE us.user_id = $1 AND s.status = 'ACTIVE' ORDER BY s.id ASC`,
          [user.id]
        );
        stores = storeRes.rows;
      }
    } else {
      if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
        stores = memoryStore.stores.filter(s => s.status === 'ACTIVE');
      } else {
        const userStoreIds = memoryStore.user_stores
          .filter(us => us.user_id === user.id)
          .map(us => us.store_id);
        stores = memoryStore.stores.filter(s => userStoreIds.includes(s.id) && s.status === 'ACTIVE');
      }
    }

    res.json({
      success: true,
      user,
      stores,
      roleFeatures: await getRoleFeatures(user.role, req.storeId || stores.find(store => store.is_default)?.id || stores[0]?.id, user.id)
    });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy thông tin người dùng' });
  }
}

module.exports = {
  login,
  getMe
};
