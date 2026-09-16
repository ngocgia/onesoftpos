const { pool, isPostgresConnected, memoryStore } = require('../config/db');

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
    enableInventory: true
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

  return features;
}

async function getStores(req, res) {
  try {
    let stores = [];
    if (isPostgresConnected()) {
      const result = await pool.query(
        `SELECT s.*, st.code as store_type_code, st.name as store_type_name 
         FROM stores s 
         LEFT JOIN store_types st ON s.store_type_id = st.id 
         ORDER BY s.id ASC`
      );
      stores = result.rows;
    } else {
      stores = memoryStore.stores.map(s => {
        const st = memoryStore.store_types.find(t => t.id === s.store_type_id);
        return {
          ...s,
          store_type_code: st ? st.code : '',
          store_type_name: st ? st.name : ''
        };
      });
    }

    res.json({ success: true, stores });
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

    res.json({
      success: true,
      store,
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
    let newStore = null;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const insertRes = await client.query(
          `INSERT INTO stores (code, name, display_name, store_type_id, phone, email, address, province, district, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE') RETURNING *`,
          [code, name, display_name || name, store_type_id, phone, email, address, province, district]
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
        kds_enabled: true
      });
    }

    res.status(201).json({ success: true, message: 'Tạo cửa hàng thành công', store: newStore });
  } catch (error) {
    console.error('createStore error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo cửa hàng: ' + error.message });
  }
}

async function updateStore(req, res) {
  const storeId = parseInt(req.params.id, 10);
  const { name, display_name, store_type_id, phone, email, address, status } = req.body;

  try {
    if (isPostgresConnected()) {
      await pool.query(
        `UPDATE stores 
         SET name = COALESCE($1, name),
             display_name = COALESCE($2, display_name),
             store_type_id = COALESCE($3, store_type_id),
             phone = COALESCE($4, phone),
             email = COALESCE($5, email),
             address = COALESCE($6, address),
             status = COALESCE($7, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [name, display_name, store_type_id, phone, email, address, status, storeId]
      );
    } else {
      const store = memoryStore.stores.find(s => s.id === storeId);
      if (!store) return res.status(404).json({ success: false, message: 'Không tìm thấy cửa hàng' });
      if (name) store.name = name;
      if (display_name) store.display_name = display_name;
      if (store_type_id) store.store_type_id = parseInt(store_type_id, 10);
      if (phone) store.phone = phone;
      if (email) store.email = email;
      if (address) store.address = address;
      if (status) store.status = status;
    }

    res.json({ success: true, message: 'Cập nhật thông tin cửa hàng thành công' });
  } catch (error) {
    console.error('updateStore error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật cửa hàng' });
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

async function updateStoreSettings(req, res) {
  const storeId = parseInt(req.params.id, 10);
  const { 
    receipt_header, 
    receipt_footer, 
    receipt_paper_size, 
    bank_name, 
    bank_account_number, 
    bank_account_holder, 
    kds_enabled 
  } = req.body;

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
             updated_at = CURRENT_TIMESTAMP
         WHERE store_id = $8`,
        [receipt_header, receipt_footer, receipt_paper_size, bank_name, bank_account_number, bank_account_holder, kds_enabled, storeId]
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
  getStoreTypes,
  updateStoreTypeFeature,
  updateStoreSettings
};
