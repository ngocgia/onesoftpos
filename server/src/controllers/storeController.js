const { pool, isPostgresConnected, memoryStore } = require('../config/db');
const { validateWorkflow } = require('../services/workflowService');
const { parseLifecycle, publicStoreLifecycle } = require('../services/storeLifecycle');

// Helper to format features as clean camelCase flags
function formatFeatures(featureRows = []) {
  const features = {
    enableSale: true,
    enableTakeaway: true,
    enableDineIn: false,
    enableTable: false,
    enableKds: true,
    enableInvoice: true,
    enableQrPayment: true,
    enableInventory: true,
    enableTakeawayWorkspace: false
  };

  featureRows.forEach(f => {
    if (f.feature_code === 'SALE') features.enableSale = !!f.enabled;
    if (f.feature_code === 'TAKEAWAY') features.enableTakeaway = !!f.enabled;
    if (f.feature_code === 'DINE_IN') features.enableDineIn = !!f.enabled;
    if (f.feature_code === 'TABLE') features.enableTable = !!f.enabled;
    if (f.feature_code === 'KDS') features.enableKds = !!f.enabled;
    if (f.feature_code === 'INVOICE') features.enableInvoice = !!f.enabled;
    if (f.feature_code === 'QR_PAYMENT') features.enableQrPayment = !!f.enabled;
    if (f.feature_code === 'INVENTORY') features.enableInventory = !!f.enabled;
  });

  features.enableTakeawayWorkspace = features.enableTakeaway
    && !features.enableDineIn
    && !features.enableTable;

  return features;
}

async function getStores(req, res) {
  try {
    let stores = [];
    if (isPostgresConnected()) {
      const hasGlobalAccess = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
      const result = hasGlobalAccess
        ? await pool.query(
          `SELECT s.*, st.code as store_type_code, st.name as store_type_name
           FROM stores s
           LEFT JOIN store_types st ON s.store_type_id = st.id
           ORDER BY s.id ASC`
        )
        : await pool.query(
          `SELECT s.*, st.code as store_type_code, st.name as store_type_name, us.is_default
           FROM stores s
           JOIN user_stores us ON us.store_id = s.id
           LEFT JOIN store_types st ON s.store_type_id = st.id
           WHERE us.user_id = $1
           ORDER BY us.is_default DESC, s.id ASC`,
          [req.user.id]
        );
      stores = result.rows;
    } else {
      const allowedStoreIds = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)
        ? null
        : new Set(memoryStore.user_stores.filter(us => us.user_id === req.user.id).map(us => us.store_id));
      stores = memoryStore.stores.filter(s => !allowedStoreIds || allowedStoreIds.has(s.id)).map(s => {
        const st = memoryStore.store_types.find(t => t.id === s.store_type_id);
        return {
          ...s,
          store_type_code: st ? st.code : '',
          store_type_name: st ? st.name : ''
        };
      });
    }

    res.json({ success: true, stores: stores.map(publicStoreLifecycle) });
  } catch (error) {
    console.error('getStores error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách cửa hàng' });
  }
}

async function getStoreDetails(req, res) {
  const storeId = parseInt(req.params.id, 10);
  try {
    let store = null;
    let settings = null;
    let features = null;
    let storeType = null;

    if (isPostgresConnected()) {
      const storeRes = await pool.query('SELECT * FROM stores WHERE id = $1', [storeId]);
      if (storeRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng' });
      }
      store = storeRes.rows[0];

      const settingsRes = await pool.query('SELECT * FROM store_settings WHERE store_id = $1', [storeId]);
      settings = settingsRes.rows[0] || {};

      if (store.store_type_id) {
        const typeRes = await pool.query('SELECT * FROM store_types WHERE id = $1', [store.store_type_id]);
        storeType = typeRes.rows[0];

        const featRes = await pool.query('SELECT * FROM store_type_features WHERE store_type_id = $1', [store.store_type_id]);
        features = formatFeatures(featRes.rows);
      }
    } else {
      store = memoryStore.stores.find(s => s.id === storeId);
      if (!store) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng' });
      }
      settings = memoryStore.store_settings.find(st => st.store_id === storeId) || {};
      storeType = memoryStore.store_types.find(t => t.id === store.store_type_id) || {};
      const featRows = memoryStore.store_type_features.filter(f => f.store_type_id === store.store_type_id);
      features = formatFeatures(featRows);
    }

    features = features || formatFeatures([]);
    if (typeof settings.takeaway_workspace_enabled === 'boolean') {
      features.enableTakeawayWorkspace = settings.takeaway_workspace_enabled;
    }
    settings.inventory_transactions_enabled = settings.inventory_transactions_enabled !== false;
    settings.product_modifier_popup_enabled = settings.product_modifier_popup_enabled !== false;
    if (isPostgresConnected()) {
      const result = await pool.query("SELECT payload FROM menu_preferences WHERE owner_type='store' AND owner_id=$1 AND section='workflow'", [storeId]);
      if (result.rows[0]) {
        const channels = JSON.parse(result.rows[0].payload);
        Object.assign(features, channels);
        features.enableTable = channels.enableDineIn && features.enableTable;
        features.enableTakeawayWorkspace = channels.enableTakeaway && !channels.enableDineIn;
      }
    }


    res.json({
      success: true,
      store: publicStoreLifecycle(store),
      settings,
      storeType,
      features
    });
  } catch (error) {
    console.error('getStoreDetails error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết cửa hàng' });
  }
}

async function createStore(req, res) {
  const { code, name, display_name, store_type_id, phone, email, address, province, district } = req.body;
  if (!code || !name || !store_type_id) {
    return res.status(400).json({ success: false, message: 'Vui lòng điền đủ Mã, Tên và Loại cửa hàng' });
  }

  try {
    const lifecycle = parseLifecycle(req.body);
    let newStore = null;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const insertRes = await client.query(
          `INSERT INTO stores (code, name, display_name, store_type_id, phone, email, address, province, district, status, activation_at, expires_at, usage_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10, $11, $12) RETURNING *`,
          [code, name, display_name || name, store_type_id, phone, email, address, province, district, lifecycle.activation_at ? new Date(lifecycle.activation_at) : null, lifecycle.expires_at ? new Date(lifecycle.expires_at) : null, lifecycle.usage_type || 'OFFICIAL']
        );
        newStore = insertRes.rows[0];

        await client.query(
          `INSERT INTO store_settings (store_id, receipt_header, receipt_footer)
           VALUES ($1, $2, $3)`,
          [newStore.id, name.toUpperCase(), 'Cảm ơn Quý khách & Hẹn gặp lại!']
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const id = memoryStore.stores.length ? Math.max(...memoryStore.stores.map(s => s.id)) + 1 : 1;
      newStore = {
        id,
        code,
        name,
        display_name: display_name || name,
        store_type_id: parseInt(store_type_id, 10),
        phone,
        email,
        address,
        province,
        district,
        status: 'ACTIVE',
        activation_at: lifecycle.activation_at || null,
        expires_at: lifecycle.expires_at || null,
        usage_type: lifecycle.usage_type || 'OFFICIAL',
        currency: 'VND'
      };
      memoryStore.stores.push(newStore);
      memoryStore.store_settings.push({
        store_id: id,
        receipt_header: name.toUpperCase(),
        receipt_footer: 'Cảm ơn Quý khách!',
        receipt_paper_size: '80mm',
        bank_name: 'MB Bank',
        bank_account_number: '090123456789',
        bank_account_holder: name.toUpperCase(),
        kds_enabled: true,
        kds_completion_message: 'Món ăn {mon}, bàn {ban} đã xong'
      });
    }

    res.status(201).json({ success: true, message: 'Tạo cửa hàng thành công', store: newStore });
  } catch (error) {
    console.error('createStore error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: 'Lỗi tạo cửa hàng: ' + error.message });
  }
}

async function updateStore(req, res) {
  const storeId = Number(req.params.id);
  const { name, display_name, store_type_id, phone, email, address, status } = req.body;
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role) && ['activation_at', 'expires_at', 'usage_type', 'status'].some(key => req.body[key] !== undefined)) {
    return res.status(403).json({ success: false, message: 'Chỉ quản trị viên hệ thống được thay đổi thời hạn và trạng thái cửa hàng' });
  }
  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const current = (await client.query('SELECT * FROM stores WHERE id=$1 FOR UPDATE', [storeId])).rows[0];
        if (!current) throw Object.assign(new Error('Không tìm thấy cửa hàng'), { statusCode: 404 });
        const patch = parseLifecycle(req.body, current);
        await client.query(`UPDATE stores SET name=COALESCE($1,name), display_name=COALESCE($2,display_name),
          store_type_id=COALESCE($3,store_type_id), phone=COALESCE($4,phone), email=COALESCE($5,email),
          address=COALESCE($6,address), status=COALESCE($7,status),
          activation_at=CASE WHEN $12 THEN $9 ELSE activation_at END,
          expires_at=CASE WHEN $13 THEN $10 ELSE expires_at END,
          usage_type=COALESCE($11,usage_type), updated_at=CURRENT_TIMESTAMP WHERE id=$8`,
          [name, display_name, store_type_id, phone, email, address, status, storeId,
            patch.activation_at ? new Date(patch.activation_at) : null,
            patch.expires_at ? new Date(patch.expires_at) : null, patch.usage_type,
            patch.activation_at !== undefined, patch.expires_at !== undefined]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      const store = memoryStore.stores.find(s => s.id === storeId);
      if (!store) return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng' });
      const patch = parseLifecycle(req.body, store);
      for (const key of ['name', 'display_name', 'phone', 'email', 'address', 'status']) if (req.body[key] !== undefined) store[key] = req.body[key];
      if (store_type_id) store.store_type_id = Number(store_type_id);
      Object.assign(store, patch);
    }
    res.json({ success: true, message: 'Cập nhật thông tin cửa hàng thành công' });
  } catch (error) {
    if (!error.statusCode) console.error('updateStore error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Lỗi cập nhật cửa hàng' });
  }
}

async function deleteStore(req, res) {
  const storeId = Number(req.params.id);
  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const managers = await client.query(`SELECT u.id FROM users u JOIN user_stores us ON us.user_id=u.id
          WHERE us.store_id=$1 AND u.role='STORE_MANAGER'`, [storeId]);
        const result = await client.query('DELETE FROM stores WHERE id=$1 RETURNING id', [storeId]);
        if (!result.rowCount) { const error = new Error('Không tìm thấy cửa hàng'); error.statusCode = 404; throw error; }
        if (managers.rowCount) await client.query('DELETE FROM users WHERE id=ANY($1::int[])', [managers.rows.map(item => item.id)]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      if (!memoryStore.stores.some(store => store.id === storeId)) return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng' });
      const productIds = new Set(memoryStore.products.filter(item => item.store_id === storeId).map(item => item.id));
      const variantIds = new Set(memoryStore.product_variants.filter(item => productIds.has(item.product_id)).map(item => item.id));
      const optionIds = new Set(memoryStore.product_options.filter(item => item.store_id === storeId).map(item => item.id));
      const orderIds = new Set(memoryStore.orders.filter(item => item.store_id === storeId).map(item => item.id));
      const orderItemIds = new Set(memoryStore.order_items.filter(item => orderIds.has(item.order_id)).map(item => item.id));
      const managerIds = new Set(memoryStore.user_stores.filter(link => link.store_id === storeId)
        .map(link => memoryStore.users.find(user => user.id === link.user_id))
        .filter(user => user?.role === 'STORE_MANAGER').map(user => user.id));
      memoryStore.stores = memoryStore.stores.filter(item => item.id !== storeId);
      memoryStore.store_settings = memoryStore.store_settings.filter(item => item.store_id !== storeId);
      memoryStore.user_stores = memoryStore.user_stores.filter(item => item.store_id !== storeId && !managerIds.has(item.user_id));
      memoryStore.users = memoryStore.users.filter(item => !managerIds.has(item.id));
      memoryStore.categories = memoryStore.categories.filter(item => item.store_id !== storeId);
      memoryStore.products = memoryStore.products.filter(item => item.store_id !== storeId);
      memoryStore.product_variants = memoryStore.product_variants.filter(item => !productIds.has(item.product_id));
      memoryStore.product_options = memoryStore.product_options.filter(item => item.store_id !== storeId);
      memoryStore.topping_groups = memoryStore.topping_groups.filter(item => item.store_id !== storeId);
      memoryStore.product_option_products = memoryStore.product_option_products.filter(item => !productIds.has(item.product_id) && !optionIds.has(item.option_id));
      memoryStore.areas = memoryStore.areas.filter(item => item.store_id !== storeId);
      memoryStore.tables = memoryStore.tables.filter(item => item.store_id !== storeId);
      memoryStore.shifts = memoryStore.shifts.filter(item => item.store_id !== storeId);
      memoryStore.orders = memoryStore.orders.filter(item => item.store_id !== storeId);
      memoryStore.order_items = memoryStore.order_items.filter(item => !orderIds.has(item.order_id));
      memoryStore.order_item_options = memoryStore.order_item_options.filter(item => !orderItemIds.has(item.order_item_id));
      memoryStore.payments = memoryStore.payments.filter(item => item.store_id !== storeId);
      memoryStore.store_role_features = memoryStore.store_role_features.filter(item => item.store_id !== storeId);
      memoryStore.audit_logs.forEach(log => { if (log.store_id === storeId) log.store_id = null; if (managerIds.has(log.user_id)) log.user_id = null; });
    }
    res.json({ success: true, message: 'Đã xóa cửa hàng và toàn bộ dữ liệu liên quan' });
  } catch (error) {
    console.error('deleteStore error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Lỗi xóa cửa hàng' });
  }
}

async function getStoreTypes(req, res) {
  try {
    let types = [];
    if (isPostgresConnected()) {
      const typeRes = await pool.query('SELECT * FROM store_types ORDER BY id ASC');
      types = typeRes.rows;

      for (let t of types) {
        const featRes = await pool.query('SELECT * FROM store_type_features WHERE store_type_id = $1', [t.id]);
        t.features = featRes.rows;
      }
    } else {
      types = memoryStore.store_types.map(t => {
        return {
          ...t,
          features: memoryStore.store_type_features.filter(f => f.store_type_id === t.id)
        };
      });
    }

    res.json({ success: true, storeTypes: types });
  } catch (error) {
    console.error('getStoreTypes error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy loại cửa hàng' });
  }
}

async function updateStoreTypeFeature(req, res) {
  const storeTypeId = parseInt(req.params.id, 10);
  const { feature_code, enabled } = req.body;

  if (!feature_code) {
    return res.status(400).json({ success: false, message: 'Thiếu mã tính năng' });
  }

  try {
    if (isPostgresConnected()) {
      await pool.query(
        `INSERT INTO store_type_features (store_type_id, feature_code, enabled)
         VALUES ($1, $2, $3)
         ON CONFLICT (store_type_id, feature_code) DO UPDATE SET enabled = $3`,
        [storeTypeId, feature_code, enabled]
      );
    } else {
      const idx = memoryStore.store_type_features.findIndex(
        f => f.store_type_id === storeTypeId && f.feature_code === feature_code
      );
      if (idx >= 0) {
        memoryStore.store_type_features[idx].enabled = enabled;
      } else {
        memoryStore.store_type_features.push({ store_type_id: storeTypeId, feature_code, enabled });
      }
    }

    res.json({ success: true, message: 'Đã cập nhật tính năng loại cửa hàng' });
  } catch (error) {
    console.error('updateStoreTypeFeature error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật tính năng' });
  }
}

async function createStoreType(req, res) {
  const { code, name, description = '', features = [] } = req.body;
  if (!code || !name) return res.status(400).json({ success: false, message: 'Vui lòng nhập mã và tên loại cửa hàng' });
  try {
    let storeType;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('INSERT INTO store_types (code,name,description,is_active) VALUES ($1,$2,$3,TRUE) RETURNING *', [code, name, description]);
        storeType = result.rows[0];
        for (const feature of features) await client.query(`INSERT INTO store_type_features (store_type_id,feature_code,enabled)
          VALUES ($1,$2,$3) ON CONFLICT (store_type_id,feature_code) DO UPDATE SET enabled=$3`, [storeType.id, feature.feature_code, !!feature.enabled]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      if (memoryStore.store_types.some(type => type.code === code)) return res.status(409).json({ success: false, message: 'Mã loại cửa hàng đã tồn tại' });
      const id = memoryStore.store_types.length ? Math.max(...memoryStore.store_types.map(type => type.id)) + 1 : 1;
      storeType = { id, code, name, description, is_active: true };
      memoryStore.store_types.push(storeType);
      features.forEach(feature => memoryStore.store_type_features.push({ store_type_id: id, feature_code: feature.feature_code, enabled: !!feature.enabled }));
    }
    res.status(201).json({ success: true, message: 'Tạo loại cửa hàng thành công', storeType });
  } catch (error) {
    console.error('createStoreType error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Mã loại cửa hàng đã tồn tại' : 'Lỗi tạo loại cửa hàng' });
  }
}

async function updateStoreType(req, res) {
  const id = Number(req.params.id);
  const { name, description, is_active } = req.body;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query(`UPDATE store_types SET name=COALESCE($1,name), description=COALESCE($2,description),
        is_active=COALESCE($3,is_active), updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING id`, [name, description, is_active, id]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy loại cửa hàng' });
    } else {
      const type = memoryStore.store_types.find(item => item.id === id);
      if (!type) return res.status(404).json({ success: false, message: 'Không tìm thấy loại cửa hàng' });
      if (name !== undefined) type.name = name;
      if (description !== undefined) type.description = description;
      if (is_active !== undefined) type.is_active = is_active;
    }
    res.json({ success: true, message: 'Cập nhật loại cửa hàng thành công' });
  } catch (error) {
    console.error('updateStoreType error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật loại cửa hàng' });
  }
}

async function deleteStoreType(req, res) {
  const id = Number(req.params.id);
  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE stores SET store_type_id=NULL WHERE store_type_id=$1', [id]);
        const result = await client.query('DELETE FROM store_types WHERE id=$1 RETURNING id', [id]);
        if (!result.rowCount) { const error = new Error('Không tìm thấy loại cửa hàng'); error.statusCode = 404; throw error; }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } else {
      if (!memoryStore.store_types.some(item => item.id === id)) return res.status(404).json({ success: false, message: 'Không tìm thấy loại cửa hàng' });
      memoryStore.stores.forEach(store => { if (store.store_type_id === id) store.store_type_id = null; });
      memoryStore.store_types = memoryStore.store_types.filter(item => item.id !== id);
      memoryStore.store_type_features = memoryStore.store_type_features.filter(item => item.store_type_id !== id);
    }
    res.json({ success: true, message: 'Đã xóa loại cửa hàng' });
  } catch (error) {
    console.error('deleteStoreType error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Lỗi xóa loại cửa hàng' });
  }
}

async function updateStoreSettings(req, res) {
  const storeId = parseInt(req.params.id, 10);
  const { 
    receipt_header, 
    receipt_footer, 
    receipt_paper_size, 
    bank_name, 
    bank_account_number, 
    bank_account_holder, 
    kds_enabled,
    kds_completion_message,
    takeaway_workspace_enabled,
    workflow_definition,
    admin_tabs,
    inventory_transactions_enabled,
    allow_cancel_item,
    product_modifier_popup_enabled
  } = req.body;

  if (kds_completion_message !== undefined && !['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Chỉ ADMIN hoặc SUPER_ADMIN được cấu hình câu thông báo KDS' });
  }
  if (product_modifier_popup_enabled !== undefined && !['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Chỉ ADMIN hoặc SUPER_ADMIN được cấu hình popup ghi chú' });
  }
  const normalizedKdsMessage = kds_completion_message === undefined
    ? undefined
    : String(kds_completion_message).trim() || 'Món ăn {mon}, bàn {ban} đã xong';
  const normalizedTakeawayWorkspace = takeaway_workspace_enabled === undefined
    ? undefined
    : takeaway_workspace_enabled === true || String(takeaway_workspace_enabled).toLowerCase() === 'true';
  if (normalizedKdsMessage && normalizedKdsMessage.length > 300) {
    return res.status(400).json({ success: false, message: 'Câu thông báo KDS không được vượt quá 300 ký tự' });
  }

  const normalizedInventoryTransactions = inventory_transactions_enabled === undefined
    ? undefined
    : (inventory_transactions_enabled === true || String(inventory_transactions_enabled).toLowerCase() === 'true');
  const normalizedAllowCancelItem = allow_cancel_item === undefined
    ? undefined
    : (allow_cancel_item === true || String(allow_cancel_item).toLowerCase() === 'true');
  if (product_modifier_popup_enabled !== undefined
    && ![true, false, 'true', 'false'].includes(product_modifier_popup_enabled)) {
    return res.status(400).json({ success: false, message: 'Cấu hình popup ghi chú phải là bật hoặc tắt' });
  }
  const normalizedModifierPopup = product_modifier_popup_enabled === undefined
    ? undefined
    : product_modifier_popup_enabled === true || product_modifier_popup_enabled === 'true';

  let normalizedWorkflow;
  if (workflow_definition !== undefined) {
    const validation = validateWorkflow(workflow_definition);
    if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });
    normalizedWorkflow = validation.workflow;
  }

  let parsedAdminTabs = admin_tabs;
  if (typeof parsedAdminTabs === 'string') {
    try {
      parsedAdminTabs = JSON.parse(parsedAdminTabs);
    } catch (_) {
      parsedAdminTabs = null;
    }
  }
  let normalizedAdminTabs;
  if (parsedAdminTabs !== undefined) {
    if (typeof parsedAdminTabs === 'object' && parsedAdminTabs !== null) {
      normalizedAdminTabs = {
        reports: parsedAdminTabs.reports !== false,
        stores: parsedAdminTabs.stores !== false,
        storeTypes: parsedAdminTabs.storeTypes !== false,
        products: parsedAdminTabs.products !== false,
        tables: parsedAdminTabs.tables !== false,
        staff: parsedAdminTabs.staff !== false,
        inventory: parsedAdminTabs.inventory !== false
      };
    } else {
      normalizedAdminTabs = null;
    }
  }

  try {
    if (isPostgresConnected()) {
      await pool.query(
        `UPDATE store_settings 
         SET receipt_header = COALESCE($1, receipt_header),
             receipt_footer = COALESCE($2, receipt_footer),
             receipt_paper_size = COALESCE($3, receipt_paper_size),
             bank_name = COALESCE($4, bank_name),
             bank_account_number = COALESCE($5, bank_account_number),
             bank_account_holder = COALESCE($6, bank_account_holder),
             kds_enabled = COALESCE($7, kds_enabled),
             kds_completion_message = COALESCE($8, kds_completion_message),
             takeaway_workspace_enabled = COALESCE($9, takeaway_workspace_enabled),
             workflow_definition = COALESCE($10::jsonb, workflow_definition),
             admin_tabs = CASE WHEN $11::boolean THEN $12::jsonb ELSE admin_tabs END,
             inventory_transactions_enabled = COALESCE($13, inventory_transactions_enabled),
             allow_cancel_item = COALESCE($14, allow_cancel_item),
             product_modifier_popup_enabled = COALESCE($15, product_modifier_popup_enabled),
             updated_at = CURRENT_TIMESTAMP
         WHERE store_id = $16`,
        [
          receipt_header,
          receipt_footer,
          receipt_paper_size,
          bank_name,
          bank_account_number,
          bank_account_holder,
          kds_enabled,
          normalizedKdsMessage,
          normalizedTakeawayWorkspace,
          normalizedWorkflow ? JSON.stringify(normalizedWorkflow) : null,
          parsedAdminTabs !== undefined,
          normalizedAdminTabs ? JSON.stringify(normalizedAdminTabs) : null,
          normalizedInventoryTransactions,
          normalizedAllowCancelItem,
          normalizedModifierPopup,
          storeId
        ]
      );
    } else {
      let settings = memoryStore.store_settings.find(s => s.store_id === storeId);
      if (!settings) {
        settings = { store_id: storeId };
        memoryStore.store_settings.push(settings);
      }
      if (receipt_header !== undefined) settings.receipt_header = receipt_header;
      if (receipt_footer !== undefined) settings.receipt_footer = receipt_footer;
      if (receipt_paper_size !== undefined) settings.receipt_paper_size = receipt_paper_size;
      if (bank_name !== undefined) settings.bank_name = bank_name;
      if (bank_account_number !== undefined) settings.bank_account_number = bank_account_number;
      if (bank_account_holder !== undefined) settings.bank_account_holder = bank_account_holder;
      if (kds_enabled !== undefined) settings.kds_enabled = kds_enabled;
      if (normalizedKdsMessage !== undefined) settings.kds_completion_message = normalizedKdsMessage;
      if (normalizedTakeawayWorkspace !== undefined) settings.takeaway_workspace_enabled = normalizedTakeawayWorkspace;
      if (normalizedWorkflow !== undefined) settings.workflow_definition = normalizedWorkflow;
      if (normalizedAdminTabs !== undefined) settings.admin_tabs = normalizedAdminTabs;
      if (normalizedInventoryTransactions !== undefined) settings.inventory_transactions_enabled = normalizedInventoryTransactions;
      if (normalizedAllowCancelItem !== undefined) settings.allow_cancel_item = normalizedAllowCancelItem;
      if (normalizedModifierPopup !== undefined) settings.product_modifier_popup_enabled = normalizedModifierPopup;
    }

    res.json({ success: true, message: 'Đã lưu cấu hình cửa hàng' });
  } catch (error) {
    console.error('updateStoreSettings error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật cấu hình cửa hàng' });
  }
}

module.exports = {
  getStores,
  getStoreDetails,
  createStore,
  updateStore,
  deleteStore,
  getStoreTypes,
  createStoreType,
  updateStoreType,
  deleteStoreType,
  updateStoreTypeFeature,
  updateStoreSettings
};
