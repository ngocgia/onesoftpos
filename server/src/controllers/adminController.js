const bcrypt = require('bcryptjs');
const { pool, isPostgresConnected, memoryStore } = require('../config/db');

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'ORDER_STAFF', 'CASHIER', 'KITCHEN'];
const ROLE_FEATURES = ['POS', 'TABLES', 'KDS', 'ORDERS', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT'];

function publicUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

async function dashboard(req, res) {
  try {
    if (isPostgresConnected()) {
      const [stores, users, summary, month, topStores] = await Promise.all([
        pool.query("SELECT COUNT(*)::int AS count FROM stores WHERE status = 'ACTIVE'"),
        pool.query("SELECT COUNT(*)::int AS count FROM users WHERE status = 'ACTIVE'"),
        pool.query("SELECT COUNT(*)::int AS orders, COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE payment_status = 'PAID' AND created_at >= CURRENT_DATE"),
        pool.query("SELECT COALESCE(SUM(total_amount), 0) AS revenue FROM orders WHERE payment_status = 'PAID' AND created_at >= date_trunc('month', CURRENT_DATE)"),
        pool.query(`SELECT s.id, s.name, COUNT(o.id)::int AS order_count,
                    COALESCE(SUM(o.total_amount), 0) AS revenue
                    FROM stores s LEFT JOIN orders o ON o.store_id = s.id AND o.payment_status = 'PAID'
                    GROUP BY s.id, s.name ORDER BY revenue DESC`)
      ]);
      return res.json({ success: true, activeStores: stores.rows[0].count, activeUsers: users.rows[0].count,
        todayOrders: summary.rows[0].orders, todayRevenue: Number(summary.rows[0].revenue),
        monthRevenue: Number(month.rows[0].revenue), stores: topStores.rows });
    }

    const paid = memoryStore.orders.filter(o => o.payment_status === 'PAID');
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const todayOrders = paid.filter(o => String(o.created_at || '').slice(0, 10) === today);
    const storeRows = memoryStore.stores.map(store => {
      const orders = paid.filter(o => o.store_id === store.id);
      return { id: store.id, name: store.name, order_count: orders.length,
        revenue: orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) };
    }).sort((a, b) => b.revenue - a.revenue);
    res.json({ success: true,
      activeStores: memoryStore.stores.filter(s => s.status === 'ACTIVE').length,
      activeUsers: memoryStore.users.filter(u => u.status === 'ACTIVE').length,
      todayOrders: todayOrders.length,
      todayRevenue: todayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
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
      const result = await pool.query(`SELECT u.id, u.username, u.email, u.full_name, u.phone, u.role, u.status,
        u.created_at, COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name))
        FILTER (WHERE s.id IS NOT NULL), '[]') AS stores
        FROM users u LEFT JOIN user_stores us ON us.user_id = u.id LEFT JOIN stores s ON s.id = us.store_id
        GROUP BY u.id ORDER BY u.id`);
      users = result.rows;
    } else {
      users = memoryStore.users.map(user => ({ ...publicUser(user), stores: memoryStore.user_stores
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
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`INSERT INTO users (username, password_hash, email, full_name, phone, role, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, username, email, full_name, phone, role, status, created_at`,
          [username, passwordHash, email, full_name, phone, role, status]);
        user = result.rows[0];
        for (const storeId of store_ids) await client.query('INSERT INTO user_stores (user_id, store_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [user.id, storeId]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      if (memoryStore.users.some(u => u.username === username || u.email === email)) return res.status(409).json({ success: false, message: 'Tên đăng nhập hoặc email đã tồn tại' });
      const id = memoryStore.users.length ? Math.max(...memoryStore.users.map(u => u.id)) + 1 : 1;
      user = { id, username, password_hash: passwordHash, email, full_name, phone, role, status };
      memoryStore.users.push(user);
      store_ids.forEach((storeId, index) => memoryStore.user_stores.push({ user_id: id, store_id: Number(storeId), is_default: index === 0 }));
    }
    res.status(201).json({ success: true, message: 'Tạo người dùng thành công', user: publicUser(user) });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Tên đăng nhập hoặc email đã tồn tại' : 'Lỗi tạo người dùng' });
  }
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  const { full_name, email, phone, role, status, password, store_ids } = req.body;
  if (role && !ROLES.includes(role)) return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ' });
  if (id === req.user.id && status === 'INACTIVE') return res.status(400).json({ success: false, message: 'Không thể tự khóa tài khoản đang đăng nhập' });
  try {
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`UPDATE users SET full_name=COALESCE($1,full_name), email=COALESCE($2,email),
          phone=COALESCE($3,phone), role=COALESCE($4,role), status=COALESCE($5,status),
          password_hash=COALESCE($6,password_hash), updated_at=CURRENT_TIMESTAMP WHERE id=$7 RETURNING id`,
          [full_name, email, phone, role, status, passwordHash, id]);
        if (!result.rowCount) { const error = new Error('Không tìm thấy người dùng'); error.statusCode = 404; throw error; }
        if (Array.isArray(store_ids)) {
          await client.query('DELETE FROM user_stores WHERE user_id=$1', [id]);
          for (let i = 0; i < store_ids.length; i++) await client.query('INSERT INTO user_stores (user_id,store_id,is_default) VALUES ($1,$2,$3)', [id, store_ids[i], i === 0]);
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      const user = memoryStore.users.find(u => u.id === id);
      if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      for (const key of ['full_name', 'email', 'phone', 'role', 'status']) if (req.body[key] !== undefined) user[key] = req.body[key];
      if (passwordHash) user.password_hash = passwordHash;
      if (Array.isArray(store_ids)) {
        memoryStore.user_stores = memoryStore.user_stores.filter(us => us.user_id !== id);
        store_ids.forEach((storeId, index) => memoryStore.user_stores.push({ user_id: id, store_id: Number(storeId), is_default: index === 0 }));
      }
    }
    res.json({ success: true, message: 'Cập nhật người dùng thành công' });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(error.statusCode || (error.code === '23505' ? 409 : 500)).json({ success: false, message: error.message || 'Lỗi cập nhật người dùng' });
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

module.exports = { dashboard, getUsers, createUser, updateUser, getAuditLogs, getRoleFeatures, updateRoleFeature };
