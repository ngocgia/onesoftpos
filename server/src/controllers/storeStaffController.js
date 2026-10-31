const bcrypt = require('bcryptjs');
const { pool, isPostgresConnected, memoryStore } = require('../config/db');

const STAFF_ROLES = ['ORDER_STAFF', 'CASHIER', 'KITCHEN'];
const FEATURE_CODES = ['POS', 'TABLES', 'KDS', 'ORDERS', 'HISTORY', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT', 'COMPLETED_ITEMS'];
const USER_STATUSES = ['ACTIVE', 'INACTIVE'];

function publicUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

function completedItemsOverride(value) {
  if (value === undefined) return { provided: false, value: undefined };
  if (value === null || value === '' || value === 'inherit') return { provided: true, value: null };
  return { provided: true, value: value === true || String(value).toLowerCase() === 'true' };
}

function memoryCompletedItemsAccess(user, storeId) {
  if (typeof user.completed_items_enabled === 'boolean') return user.completed_items_enabled;
  const local = memoryStore.store_role_features.find(item => item.store_id === storeId && item.role === user.role && item.feature_code === 'COMPLETED_ITEMS');
  const base = memoryStore.role_features.find(item => item.role === user.role && item.feature_code === 'COMPLETED_ITEMS');
  return local ? !!local.enabled : (base ? !!base.enabled : true);
}

async function getStaff(req, res) {
  try {
    let staff;
    if (isPostgresConnected()) {
      const result = await pool.query(`SELECT u.id,u.username,u.email,u.full_name,u.phone,u.role,u.status,u.created_at,
        u.completed_items_enabled AS completed_items_override,
        COALESCE(u.completed_items_enabled, local_feature.enabled, base_feature.enabled, TRUE) AS completed_items_enabled
        FROM users u JOIN user_stores us ON us.user_id=u.id
        LEFT JOIN role_features base_feature ON base_feature.role=u.role AND base_feature.feature_code='COMPLETED_ITEMS'
        LEFT JOIN store_role_features local_feature ON local_feature.store_id=us.store_id AND local_feature.role=u.role AND local_feature.feature_code='COMPLETED_ITEMS'
        WHERE us.store_id=$1 AND u.role=ANY($2::varchar[]) ORDER BY u.id`, [req.storeId, STAFF_ROLES]);
      staff = result.rows;
    } else {
      const ids = new Set(memoryStore.user_stores.filter(item => item.store_id === req.storeId).map(item => item.user_id));
      staff = memoryStore.users.filter(user => ids.has(user.id) && STAFF_ROLES.includes(user.role)).map(user => ({
        ...publicUser(user),
        completed_items_override: user.completed_items_enabled,
        completed_items_enabled: memoryCompletedItemsAccess(user, req.storeId)
      }));
    }
    res.json({ success: true, staff, roles: STAFF_ROLES });
  } catch (error) {
    console.error('getStoreStaff error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách nhân viên' });
  }
}

async function createStaff(req, res) {
  const { username, password, email, full_name, phone, role = 'CASHIER', status = 'ACTIVE' } = req.body;
  const completedAccess = completedItemsOverride(req.body.completed_items_enabled);
  if (!username || !password || !email || !full_name || !STAFF_ROLES.includes(role) || !USER_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin hoặc vai trò nhân viên không hợp lệ' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`INSERT INTO users (username,password_hash,email,full_name,phone,role,status,completed_items_enabled)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,username,email,full_name,phone,role,status,completed_items_enabled,created_at`,
        [username, passwordHash, email, full_name, phone, role, status, completedAccess.provided ? completedAccess.value : null]);
        user = result.rows[0];
        await client.query('INSERT INTO user_stores (user_id,store_id,is_default) VALUES ($1,$2,TRUE)', [user.id, req.storeId]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      if (memoryStore.users.some(item => item.username === username || item.email === email)) {
        return res.status(409).json({ success: false, message: 'Tên đăng nhập hoặc email đã tồn tại' });
      }
      const id = memoryStore.users.length ? Math.max(...memoryStore.users.map(item => item.id)) + 1 : 1;
      user = { id, username, password_hash: passwordHash, email, full_name, phone, role, status, completed_items_enabled: completedAccess.provided ? completedAccess.value : null, created_at: new Date().toISOString() };
      memoryStore.users.push(user);
      memoryStore.user_stores.push({ user_id: id, store_id: req.storeId, is_default: true });
    }
    res.status(201).json({ success: true, message: 'Đã tạo tài khoản nhân viên', user: publicUser(user) });
  } catch (error) {
    console.error('createStoreStaff error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Tên đăng nhập hoặc email đã tồn tại' : 'Lỗi tạo nhân viên' });
  }
}

async function findManagedStaff(storeId, userId, client = pool) {
  const result = await client.query(`SELECT u.id FROM users u JOIN user_stores us ON us.user_id=u.id
    WHERE u.id=$1 AND us.store_id=$2 AND u.role=ANY($3::varchar[])`, [userId, storeId, STAFF_ROLES]);
  return result.rowCount > 0;
}

async function updateStaff(req, res) {
  const id = Number(req.params.id);
  const { full_name, email, phone, role, status } = req.body;
  const completedAccess = completedItemsOverride(req.body.completed_items_enabled);
  if (role && !STAFF_ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Vai trò nhân viên không hợp lệ' });
  if (status && !USER_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Trạng thái nhân viên không hợp lệ' });
  try {
    if (isPostgresConnected()) {
      if (!(await findManagedStaff(req.storeId, id))) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên trong cửa hàng' });
      await pool.query(`UPDATE users SET full_name=COALESCE($1,full_name),email=COALESCE($2,email),phone=COALESCE($3,phone),
        role=COALESCE($4,role),status=COALESCE($5,status),
        completed_items_enabled=CASE WHEN $6 THEN $7 ELSE completed_items_enabled END,
        updated_at=CURRENT_TIMESTAMP WHERE id=$8`, [full_name, email, phone, role, status, completedAccess.provided, completedAccess.value, id]);
    } else {
      const assigned = memoryStore.user_stores.some(item => item.user_id === id && item.store_id === req.storeId);
      const user = memoryStore.users.find(item => item.id === id && STAFF_ROLES.includes(item.role));
      if (!assigned || !user) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên trong cửa hàng' });
      for (const field of ['full_name', 'email', 'phone', 'role', 'status']) if (req.body[field] !== undefined) user[field] = req.body[field];
      if (completedAccess.provided) user.completed_items_enabled = completedAccess.value;
    }
    res.json({ success: true, message: 'Đã cập nhật nhân viên' });
  } catch (error) {
    console.error('updateStoreStaff error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Email đã tồn tại' : 'Lỗi cập nhật nhân viên' });
  }
}

async function resetPassword(req, res) {
  const id = Number(req.params.id);
  const { password } = req.body;
  if (!password || String(password).length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    if (isPostgresConnected()) {
      if (!(await findManagedStaff(req.storeId, id))) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên trong cửa hàng' });
      // Bumping token_version revokes every JWT the staff member still holds.
      await pool.query('UPDATE users SET password_hash=$1,token_version=token_version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [passwordHash, id]);
    } else {
      const assigned = memoryStore.user_stores.some(item => item.user_id === id && item.store_id === req.storeId);
      const user = memoryStore.users.find(item => item.id === id && STAFF_ROLES.includes(item.role));
      if (!assigned || !user) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên trong cửa hàng' });
      user.password_hash = passwordHash;
      user.token_version = (user.token_version || 0) + 1;
    }
    res.json({ success: true, message: 'Đã đặt lại mật khẩu nhân viên' });
  } catch (error) {
    console.error('resetStaffPassword error:', error);
    res.status(500).json({ success: false, message: 'Lỗi đặt lại mật khẩu' });
  }
}

async function getStoreRoleFeatures(req, res) {
  try {
    let baseRows;
    let localRows;
    if (isPostgresConnected()) {
      [baseRows, localRows] = await Promise.all([
        pool.query('SELECT role,feature_code,enabled FROM role_features WHERE role=ANY($1::varchar[])', [STAFF_ROLES]),
        pool.query('SELECT role,feature_code,enabled FROM store_role_features WHERE store_id=$1 AND role=ANY($2::varchar[])', [req.storeId, STAFF_ROLES])
      ]);
      baseRows = baseRows.rows;
      localRows = localRows.rows;
    } else {
      baseRows = memoryStore.role_features.filter(item => STAFF_ROLES.includes(item.role));
      localRows = memoryStore.store_role_features.filter(item => item.store_id === req.storeId && STAFF_ROLES.includes(item.role));
    }
    const roles = STAFF_ROLES.map(role => ({ role, features: FEATURE_CODES.map(feature_code => {
      const local = localRows.find(item => item.role === role && item.feature_code === feature_code);
      const base = baseRows.find(item => item.role === role && item.feature_code === feature_code);
      return { feature_code, enabled: local ? !!local.enabled : (base ? !!base.enabled : true) };
    }) }));
    res.json({ success: true, roles, featureCodes: FEATURE_CODES });
  } catch (error) {
    console.error('getStoreRoleFeatures error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy phân quyền cửa hàng' });
  }
}

async function updateStoreRoleFeature(req, res) {
  const role = String(req.params.role || '').toUpperCase();
  const { feature_code, enabled } = req.body;
  if (!STAFF_ROLES.includes(role) || !FEATURE_CODES.includes(feature_code)) {
    return res.status(400).json({ success: false, message: 'Vai trò hoặc chức năng không hợp lệ' });
  }
  try {
    if (isPostgresConnected()) {
      await pool.query(`INSERT INTO store_role_features (store_id,role,feature_code,enabled) VALUES ($1,$2,$3,$4)
        ON CONFLICT (store_id,role,feature_code) DO UPDATE SET enabled=$4,updated_at=CURRENT_TIMESTAMP`, [req.storeId, role, feature_code, !!enabled]);
    } else {
      const found = memoryStore.store_role_features.find(item => item.store_id === req.storeId && item.role === role && item.feature_code === feature_code);
      if (found) found.enabled = !!enabled;
      else memoryStore.store_role_features.push({ store_id: req.storeId, role, feature_code, enabled: !!enabled });
    }
    res.json({ success: true, message: 'Đã cập nhật chức năng cho nhân viên cửa hàng' });
  } catch (error) {
    console.error('updateStoreRoleFeature error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật phân quyền' });
  }
}

module.exports = { getStaff, createStaff, updateStaff, resetPassword, getStoreRoleFeatures, updateStoreRoleFeature };
