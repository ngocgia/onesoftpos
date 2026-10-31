const bcrypt = require('bcryptjs');
const { DEFAULT_SESSION_DAYS, parseSessionDays, getSessionDays } = require('../services/sessionDuration');
const { pool, isPostgresConnected, memoryStore } = require('../config/db');

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'ORDER_STAFF', 'CASHIER', 'KITCHEN'];
const ROLE_FEATURES = ['POS', 'TABLES', 'KDS', 'ORDERS', 'HISTORY', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT', 'COMPLETED_ITEMS'];

function publicUser(user) {
  const { password_hash, ...safe } = user;
  return { ...safe, session_duration_days: getSessionDays(user.session_duration_days) };
}

function completedItemsOverride(value) {
  if (value === undefined) return { provided: false, value: undefined };
  if (value === null || value === '' || value === 'inherit') return { provided: true, value: null };
  return { provided: true, value: value === true || String(value).toLowerCase() === 'true' };
}

function normalizeStoreIds(storeIds) {
  if (!Array.isArray(storeIds)) return [];
  const normalized = storeIds.map(Number);
  if (normalized.some(id => !Number.isInteger(id) || id <= 0)) {
    const error = new Error('Danh sách cửa hàng không hợp lệ');
    error.statusCode = 400;
    throw error;
  }
  return [...new Set(normalized)];
}

function assertStoreManagerAssignment(role, storeIds) {
  if (role === 'STORE_MANAGER' && storeIds.length !== 1) {
    const error = new Error('STORE_MANAGER phải được phân công đúng một cửa hàng');
    error.statusCode = 400;
    throw error;
  }
}

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function nextDate(value) {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return dateOnly(date);
}

async function dashboardQuery(label, sql, params, fallbackRows) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    // One unavailable statistic must not take down the entire admin page.
    // Keep the detailed database error in server logs for diagnosis.
    console.error(`admin dashboard query error [${label}]:`, error);
    return { rows: fallbackRows, rowCount: fallbackRows.length };
  }
}

async function dashboard(req, res) {
  try {
    const { startDate, endDate } = req.query;
    if (isPostgresConnected()) {
      const today = dateOnly(new Date());
      let rangeStart = today;
      let rangeEnd = nextDate(today);
      if (startDate && endDate) {
        if (!parseDateOnly(startDate) || !parseDateOnly(endDate) || startDate > endDate) {
          return res.status(400).json({ success: false, message: 'Khoảng ngày không hợp lệ' });
        }
        rangeStart = startDate;
        rangeEnd = nextDate(endDate);
      }
      const rangeParams = [`${rangeStart} 00:00:00`, `${rangeEnd} 00:00:00`];
      const monthStart = `${today.slice(0, 7)}-01 00:00:00`;

      const [stores, users, summary, month, topStores] = await Promise.all([
        dashboardQuery('active stores', "SELECT COUNT(*)::int AS count FROM stores WHERE status = 'ACTIVE'", [], [{ count: 0 }]),
        dashboardQuery('active users', "SELECT COUNT(*)::int AS count FROM users WHERE status = 'ACTIVE'", [], [{ count: 0 }]),
        // Exclude cancelled orders (e.g. merged-table source orders) from revenue so it is not double counted.
        dashboardQuery('range summary', "SELECT COUNT(*)::int AS orders, COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE payment_status = 'PAID' AND order_status <> 'CANCELLED' AND created_at >= $1 AND created_at < $2", rangeParams, [{ orders: 0, revenue: 0 }]),
        dashboardQuery('month revenue', "SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE payment_status = 'PAID' AND order_status <> 'CANCELLED' AND created_at >= $1", [monthStart], [{ revenue: 0 }]),
        dashboardQuery('store ranking', `SELECT s.id, s.name, COUNT(o.id)::int AS order_count,
                    COALESCE(SUM(o.total_amount), 0) AS revenue
                    FROM stores s LEFT JOIN orders o ON o.store_id = s.id AND o.payment_status = 'PAID'
                      AND o.order_status <> 'CANCELLED'
                      AND o.created_at >= $1 AND o.created_at < $2
                    GROUP BY s.id, s.name ORDER BY revenue DESC`, rangeParams, [])
      ]);
      return res.json({ success: true, activeStores: stores.rows[0].count, activeUsers: users.rows[0].count,
        todayOrders: summary.rows[0].orders, todayRevenue: Number(summary.rows[0].revenue),
        monthRevenue: Number(month.rows[0].revenue), stores: topStores.rows });
    }

    // Exclude cancelled orders (e.g. merged-table source orders) so revenue is not double counted.
    const paid = memoryStore.orders.filter(o => o.payment_status === 'PAID' && o.order_status !== 'CANCELLED');
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    
    let filteredOrders = paid.filter(o => String(o.created_at || '').slice(0, 10) === today);
    if (startDate && endDate) {
      filteredOrders = paid.filter(o => {
        const d = String(o.created_at || '').slice(0, 10);
        return d >= startDate && d <= endDate;
      });
    }

    const storeRows = memoryStore.stores.map(store => {
      const orders = filteredOrders.filter(o => o.store_id === store.id);
      return { id: store.id, name: store.name, order_count: orders.length,
        revenue: orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) };
    }).sort((a, b) => b.revenue - a.revenue);
    res.json({ success: true,
      activeStores: memoryStore.stores.filter(s => s.status === 'ACTIVE').length,
      activeUsers: memoryStore.users.filter(u => u.status === 'ACTIVE').length,
      todayOrders: filteredOrders.length,
      todayRevenue: filteredOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      monthRevenue: paid.filter(o => String(o.created_at || '').slice(0, 7) === month)
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      stores: storeRows
    });
  } catch (error) {
    console.error('admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải tổng quan hệ thống' });
  }
}

async function getUsers(req, res) {
  try {
    let users;
    if (isPostgresConnected()) {
      const storesSql = process.env.DB_CLIENT === 'mysql'
        ? "CASE WHEN COUNT(s.id)=0 THEN JSON_ARRAY() ELSE JSON_ARRAYAGG(JSON_OBJECT('id',s.id,'name',s.name)) END"
        : "COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]')";
      const result = await pool.query(`SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role, u.status, u.session_duration_days,
        u.completed_items_enabled AS completed_items_override,
        COALESCE(u.completed_items_enabled,
          (SELECT enabled FROM role_features rf WHERE rf.role=u.role AND rf.feature_code='COMPLETED_ITEMS'), TRUE) AS completed_items_enabled,
        u.created_at, ${storesSql} AS stores
        FROM users u LEFT JOIN user_stores us ON us.user_id = u.id LEFT JOIN stores s ON s.id = us.store_id
        GROUP BY u.id ORDER BY u.id`);
      users = result.rows.map(user => ({ ...user, stores: typeof user.stores === 'string' ? JSON.parse(user.stores) : user.stores }));
    } else {
      users = memoryStore.users.map(user => ({ ...publicUser(user),
        completed_items_override: user.completed_items_enabled,
        completed_items_enabled: typeof user.completed_items_enabled === 'boolean' ? user.completed_items_enabled :
          (memoryStore.role_features.find(item => item.role === user.role && item.feature_code === 'COMPLETED_ITEMS')?.enabled ?? true),
        stores: memoryStore.user_stores
        .filter(us => us.user_id === user.id).map(us => memoryStore.stores.find(s => s.id === us.store_id)).filter(Boolean)
        .map(s => ({ id: s.id, name: s.name })) }));
    }
    res.json({ success: true, users, roles: ROLES });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách người dùng' });
  }
}

async function createUser(req, res) {
  const { username, password, email, full_name, phone, role = 'CASHIER', status = 'ACTIVE', store_ids = [] } = req.body;
  if (!username || !password || !email || !full_name || !ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc hoặc vai trò không hợp lệ' });
  }
  // Only SUPER_ADMIN may create SUPER_ADMIN accounts; ADMIN must not escalate privileges.
  if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'Chỉ SUPER_ADMIN mới có thể quản lý tài khoản SUPER_ADMIN' });
  }
  try {
    const sessionDays = parseSessionDays(req.body.session_duration_days);
    const completedAccess = completedItemsOverride(req.body.completed_items_enabled);
    const normalizedStoreIds = normalizeStoreIds(store_ids);
    assertStoreManagerAssignment(role, normalizedStoreIds);
    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`INSERT INTO users (username, password_hash, email, full_name, phone, role, status, completed_items_enabled, session_duration_days)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, username, email, full_name, phone, role, status, completed_items_enabled, session_duration_days, created_at`,
          [username, passwordHash, email, full_name, phone, role, status, completedAccess.provided ? completedAccess.value : null, sessionDays ?? DEFAULT_SESSION_DAYS]);
        user = result.rows[0];
        for (let i = 0; i < normalizedStoreIds.length; i++) {
          await client.query(
            'INSERT INTO user_stores (user_id, store_id, is_default) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
            [user.id, normalizedStoreIds[i], i === 0]
          );
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      if (memoryStore.users.some(u => u.username === username || u.email === email)) return res.status(409).json({ success: false, message: 'Tên đăng nhập hoặc email đã tồn tại' });
      const id = memoryStore.users.length ? Math.max(...memoryStore.users.map(u => u.id)) + 1 : 1;
      user = { id, username, password_hash: passwordHash, email, full_name, phone, role, status, completed_items_enabled: completedAccess.provided ? completedAccess.value : null, session_duration_days: sessionDays ?? DEFAULT_SESSION_DAYS };
      memoryStore.users.push(user);
      normalizedStoreIds.forEach((storeId, index) => memoryStore.user_stores.push({ user_id: id, store_id: storeId, is_default: index === 0 }));
    }
    res.status(201).json({ success: true, message: 'Tạo người dùng thành công', user: publicUser(user) });
  } catch (error) {
    if (!error.statusCode) console.error('createUser error:', error);
    res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({ success: false, message: error.statusCode ? error.message : (error.code === '23505' ? 'Tên đăng nhập hoặc email đã tồn tại' : 'Lỗi tạo người dùng') });
  }
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  const { full_name, email, phone, role, status, password, store_ids } = req.body;
  if (role && !ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
  // Only SUPER_ADMIN may promote anyone (including self) to SUPER_ADMIN.
  if (role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'Chỉ SUPER_ADMIN mới có thể quản lý tài khoản SUPER_ADMIN' });
  }
  if (id === req.user.id && status === 'INACTIVE') return res.status(400).json({ success: false, message: 'Không thể tự khóa tài khoản đang đăng nhập' });
  try {
    const sessionDays = parseSessionDays(req.body.session_duration_days);
    const completedAccess = completedItemsOverride(req.body.completed_items_enabled);
    const normalizedStoreIds = Array.isArray(store_ids) ? normalizeStoreIds(store_ids) : null;
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const storeIdsSql = process.env.DB_CLIENT === 'mysql'
          ? 'CASE WHEN COUNT(us.store_id)=0 THEN JSON_ARRAY() ELSE JSON_ARRAYAGG(us.store_id) END'
          : "COALESCE(array_agg(us.store_id) FILTER (WHERE us.store_id IS NOT NULL), '{}')";
        const current = await client.query(
          `SELECT u.role, ${storeIdsSql} AS store_ids
           FROM users u LEFT JOIN user_stores us ON us.user_id = u.id
           WHERE u.id = $1 GROUP BY u.id`,
          [id]
        );
        if (!current.rowCount) { const error = new Error('Không tìm thấy người dùng'); error.statusCode = 404; throw error; }
        // Only SUPER_ADMIN may modify an existing SUPER_ADMIN account.
        if (current.rows[0].role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
          const error = new Error('Chỉ SUPER_ADMIN mới có thể quản lý tài khoản SUPER_ADMIN');
          error.statusCode = 403;
          throw error;
        }
        const effectiveRole = role || current.rows[0].role;
        const currentStoreIds = current.rows[0].store_ids;
        const effectiveStoreIds = normalizedStoreIds || (typeof currentStoreIds === 'string' ? JSON.parse(currentStoreIds) : currentStoreIds).map(Number);
        assertStoreManagerAssignment(effectiveRole, effectiveStoreIds);
        const result = await client.query(`UPDATE users SET full_name=COALESCE($1,full_name), email=COALESCE($2,email),
          phone=COALESCE($3,phone), role=COALESCE($4,role), status=COALESCE($5,status),
          password_hash=COALESCE($6,password_hash),
          completed_items_enabled=CASE WHEN $7 THEN $8 ELSE completed_items_enabled END,
          session_duration_days=COALESCE($10,session_duration_days),
          updated_at=CURRENT_TIMESTAMP WHERE id=$9 RETURNING id`,
          [full_name, email, phone, role, status, passwordHash, completedAccess.provided, completedAccess.value, id, sessionDays]);
        if (!result.rowCount) { const error = new Error('Không tìm thấy người dùng'); error.statusCode = 404; throw error; }
        if (normalizedStoreIds) {
          await client.query('DELETE FROM user_stores WHERE user_id=$1', [id]);
          for (let i = 0; i < normalizedStoreIds.length; i++) await client.query('INSERT INTO user_stores (user_id,store_id,is_default) VALUES ($1,$2,$3)', [id, normalizedStoreIds[i], i === 0]);
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      const user = memoryStore.users.find(u => u.id === id);
      if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      // Only SUPER_ADMIN may modify an existing SUPER_ADMIN account.
      if (user.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Chỉ SUPER_ADMIN mới có thể quản lý tài khoản SUPER_ADMIN' });
      }
      const currentStoreIds = memoryStore.user_stores.filter(us => us.user_id === id).map(us => us.store_id);
      assertStoreManagerAssignment(role || user.role, normalizedStoreIds || currentStoreIds);
      for (const key of ['full_name', 'email', 'phone', 'role', 'status']) if (req.body[key] !== undefined) user[key] = req.body[key];
      if (passwordHash) user.password_hash = passwordHash;
      if (completedAccess.provided) user.completed_items_enabled = completedAccess.value;
      if (sessionDays !== undefined) user.session_duration_days = sessionDays;
      if (normalizedStoreIds) {
        memoryStore.user_stores = memoryStore.user_stores.filter(us => us.user_id !== id);
        normalizedStoreIds.forEach((storeId, index) => memoryStore.user_stores.push({ user_id: id, store_id: storeId, is_default: index === 0 }));
      }
    }
    res.json({ success: true, message: 'Cập nhật người dùng thành công' });
  } catch (error) {
    if (!error.statusCode) console.error('updateUser error:', error);
    res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({ success: false, message: error.message || 'Lỗi cập nhật người dùng' });
  }
}

async function deleteUser(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ success: false, message: 'Không thể tự xóa tài khoản đang đăng nhập' });
  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const target = await client.query('SELECT role FROM users WHERE id = $1', [id]);
        if (!target.rowCount) { const error = new Error('Không tìm thấy người dùng'); error.statusCode = 404; throw error; }
        // Only SUPER_ADMIN may delete a SUPER_ADMIN account.
        if (target.rows[0].role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
          const error = new Error('Chỉ SUPER_ADMIN mới có thể quản lý tài khoản SUPER_ADMIN');
          error.statusCode = 403;
          throw error;
        }
        await client.query('UPDATE shifts SET user_id=NULL WHERE user_id=$1', [id]);
        await client.query('UPDATE orders SET cashier_id=NULL WHERE cashier_id=$1', [id]);
        await client.query('UPDATE orders SET confirmed_by=NULL WHERE confirmed_by=$1', [id]);
        await client.query('UPDATE order_items SET prepared_by=NULL WHERE prepared_by=$1', [id]);
        const result = await client.query('DELETE FROM users WHERE id=$1 RETURNING id', [id]);
        if (!result.rowCount) { const error = new Error('Không tìm thấy người dùng'); error.statusCode = 404; throw error; }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      const targetUser = memoryStore.users.find(user => user.id === id);
      if (!targetUser) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      // Only SUPER_ADMIN may delete a SUPER_ADMIN account.
      if (targetUser.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Chỉ SUPER_ADMIN mới có thể quản lý tài khoản SUPER_ADMIN' });
      }
      memoryStore.users = memoryStore.users.filter(user => user.id !== id);
      memoryStore.user_stores = memoryStore.user_stores.filter(link => link.user_id !== id);
      memoryStore.shifts.forEach(item => { if (item.user_id === id) item.user_id = null; });
      memoryStore.orders.forEach(item => { if (item.cashier_id === id) item.cashier_id = null; if (item.confirmed_by === id) item.confirmed_by = null; });
      memoryStore.order_items.forEach(item => { if (item.prepared_by === id) item.prepared_by = null; });
      memoryStore.audit_logs.forEach(log => { if (log.user_id === id) log.user_id = null; });
    }
    res.json({ success: true, message: 'Đã xóa người dùng' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Lỗi xóa người dùng' });
  }
}

async function getAuditLogs(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  try {
    let logs;
    if (isPostgresConnected()) {
      const result = await pool.query(`SELECT a.*, u.full_name AS user_name, s.name AS store_name FROM audit_logs a
        LEFT JOIN users u ON u.id=a.user_id LEFT JOIN stores s ON s.id=a.store_id ORDER BY a.created_at DESC LIMIT $1`, [limit]);
      logs = result.rows;
    } else {
      logs = [...memoryStore.audit_logs].reverse().slice(0, limit).map(log => ({ ...log,
        user_name: memoryStore.users.find(u => u.id === log.user_id)?.full_name,
        store_name: memoryStore.stores.find(s => s.id === log.store_id)?.name }));
    }
    res.json({ success: true, logs });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy nhật ký hệ thống' });
  }
}

async function clearAuditLogs(req, res) {
  try {
    if (isPostgresConnected()) await pool.query('DELETE FROM audit_logs');
    else memoryStore.audit_logs = [];
    res.json({ success: true, message: 'Đã xóa toàn bộ nhật ký hệ thống' });
  } catch (error) {
    console.error('clearAuditLogs error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xóa nhật ký hệ thống' });
  }
}

async function getRoleFeatures(req, res) {
  try {
    let rows;
    if (isPostgresConnected()) {
      const result = await pool.query('SELECT role, feature_code, enabled FROM role_features ORDER BY role, feature_code');
      rows = result.rows;
    } else {
      rows = memoryStore.role_features;
    }
    const configurableRoles = ROLES.filter(role => role !== 'SUPER_ADMIN');
    const matrix = configurableRoles.map(role => ({
      role,
      features: ROLE_FEATURES.map(featureCode => {
        const found = rows.find(row => row.role === role && row.feature_code === featureCode);
        return { feature_code: featureCode, enabled: found ? !!found.enabled : true };
      })
    }));
    res.json({ success: true, roles: matrix, featureCodes: ROLE_FEATURES });
  } catch (error) {
    console.error('getRoleFeatures error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy cấu hình chức năng theo vai trò' });
  }
}

async function updateRoleFeature(req, res) {
  const role = String(req.params.role || '').toUpperCase();
  const { feature_code, enabled } = req.body;
  if (role === 'SUPER_ADMIN' || !ROLES.includes(role) || !ROLE_FEATURES.includes(feature_code)) {
    return res.status(400).json({ success: false, message: 'Vai trò hoặc chức năng không hợp lệ' });
  }
  try {
    if (isPostgresConnected()) {
      await pool.query(`INSERT INTO role_features (role, feature_code, enabled) VALUES ($1,$2,$3)
        ON CONFLICT (role, feature_code) DO UPDATE SET enabled=$3, updated_at=CURRENT_TIMESTAMP`,
        [role, feature_code, !!enabled]);
    } else {
      const found = memoryStore.role_features.find(item => item.role === role && item.feature_code === feature_code);
      if (found) found.enabled = !!enabled;
      else memoryStore.role_features.push({ role, feature_code, enabled: !!enabled });
    }
    res.json({ success: true, message: 'Đã cập nhật quyền hiển thị chức năng' });
  } catch (error) {
    console.error('updateRoleFeature error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật chức năng theo vai trò' });
  }
}

module.exports = { dashboard, getUsers, createUser, updateUser, deleteUser, getAuditLogs, clearAuditLogs, getRoleFeatures, updateRoleFeature };
