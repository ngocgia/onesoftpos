const { pool, isPostgresConnected, memoryStore } = require('../config/db');

// Helper: Lấy allow_negative_stock của cửa hàng
async function getStoreAllowNegativeStock(storeId) {
  if (isPostgresConnected()) {
    const res = await pool.query('SELECT allow_negative_stock FROM store_settings WHERE store_id = $1', [storeId]);
    return res.rows[0]?.allow_negative_stock || false;
  }
  const setting = memoryStore.store_settings?.find(s => s.store_id === storeId);
  return setting?.allow_negative_stock || false;
}

// Helper: Lấy cấu hình bật/tắt nghiệp vụ phiếu kho của cửa hàng
async function getStoreInventoryTransactionsEnabled(storeId) {
  if (isPostgresConnected()) {
    const res = await pool.query('SELECT inventory_transactions_enabled FROM store_settings WHERE store_id = $1', [storeId]);
    return res.rows[0]?.inventory_transactions_enabled !== false;
  }
  const setting = memoryStore.store_settings?.find(s => s.store_id === storeId);
  return setting?.inventory_transactions_enabled !== false;
}

// 1. Danh sách mặt hàng kho
async function getItems(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const { search, category, low_stock, include_inactive } = req.query;

  try {
    let items = [];

    if (isPostgresConnected()) {
      let query = 'SELECT * FROM inventory_items WHERE store_id = $1';
      const params = [storeId];
      let paramIdx = 2;

      if (include_inactive !== 'true') {
        query += ' AND is_active = TRUE';
      }
      if (category) {
        query += ` AND category = $${paramIdx++}`;
        params.push(category);
      }
      if (search) {
        query += ` AND (code ILIKE $${paramIdx} OR name ILIKE $${paramIdx})`;
        params.push(`%${search}%`);
        paramIdx++;
      }
      if (low_stock === 'true') {
        query += ' AND current_stock <= min_stock';
      }

      query += ' ORDER BY category ASC, name ASC';
      const result = await pool.query(query, params);
      items = result.rows.map(item => ({
        ...item,
        cost_price: Number(item.cost_price || 0),
        current_stock: Number(item.current_stock || 0),
        min_stock: Number(item.min_stock || 0),
        total_value: Math.round(Number(item.current_stock || 0) * Number(item.cost_price || 0))
      }));
    } else {
      items = (memoryStore.inventory_items || [])
        .filter(item => {
          if (item.store_id !== storeId) return false;
          if (include_inactive !== 'true' && !item.is_active) return false;
          if (category && item.category !== category) return false;
          if (search) {
            const q = search.toLowerCase();
            const matchCode = (item.code || '').toLowerCase().includes(q);
            const matchName = (item.name || '').toLowerCase().includes(q);
            if (!matchCode && !matchName) return false;
          }
          if (low_stock === 'true' && Number(item.current_stock || 0) > Number(item.min_stock || 0)) {
            return false;
          }
          return true;
        })
        .map(item => ({
          ...item,
          cost_price: Number(item.cost_price || 0),
          current_stock: Number(item.current_stock || 0),
          min_stock: Number(item.min_stock || 0),
          total_value: Math.round(Number(item.current_stock || 0) * Number(item.cost_price || 0))
        }))
        .sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
    }

    res.json({ success: true, items });
  } catch (error) {
    console.error('getItems error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách mặt hàng kho' });
  }
}

// 2. Chi tiết 1 mặt hàng
async function getItemById(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const id = Number(req.params.id);

  try {
    let item = null;
    let transactions = [];

    if (isPostgresConnected()) {
      const resItem = await pool.query(
        'SELECT * FROM inventory_items WHERE id = $1 AND store_id = $2',
        [id, storeId]
      );
      if (!resItem.rows.length) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mặt hàng kho' });
      }
      item = {
        ...resItem.rows[0],
        cost_price: Number(resItem.rows[0].cost_price || 0),
        current_stock: Number(resItem.rows[0].current_stock || 0),
        min_stock: Number(resItem.rows[0].min_stock || 0)
      };

      const resTrans = await pool.query(
        `SELECT t.*, u.full_name as user_name 
         FROM inventory_transactions t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.item_id = $1 AND t.store_id = $2
         ORDER BY t.created_at DESC LIMIT 20`,
        [id, storeId]
      );
      transactions = resTrans.rows;
    } else {
      item = (memoryStore.inventory_items || []).find(i => i.id === id && i.store_id === storeId);
      if (!item) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mặt hàng kho' });
      }
      transactions = (memoryStore.inventory_transactions || [])
        .filter(t => t.item_id === id && t.store_id === storeId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20)
        .map(t => {
          const user = (memoryStore.users || []).find(u => u.id === t.user_id);
          return { ...t, user_name: user?.full_name || 'Hệ thống' };
        });
    }

    res.json({ success: true, item, transactions });
  } catch (error) {
    console.error('getItemById error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy thông tin mặt hàng kho' });
  }
}

// 3. Thêm mặt hàng kho mới
async function createItem(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const rawCode = req.body.code || req.body.sku;
  const { name, category, unit, cost_price, current_stock, min_stock } = req.body;

  if (!rawCode || !name) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mã và tên mặt hàng' });
  }

  const cleanCode = String(rawCode).trim().toUpperCase();
  const cleanName = String(name).trim();
  const cleanCategory = String(category || 'Nguyên liệu').trim();
  const cleanUnit = String(unit || 'kg').trim();
  const numCost = Number(cost_price || 0);
  const numStock = Number(current_stock || 0);
  const numMin = Number(min_stock || 5);

  try {
    let newItem = null;

    if (isPostgresConnected()) {
      const check = await pool.query(
        'SELECT id FROM inventory_items WHERE store_id = $1 AND code = $2',
        [storeId, cleanCode]
      );
      if (check.rows.length > 0) {
        return res.status(400).json({ success: false, message: `Mã mặt hàng "${cleanCode}" đã tồn tại` });
      }

      const result = await pool.query(
        `INSERT INTO inventory_items (store_id, code, name, category, unit, cost_price, current_stock, min_stock, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE) RETURNING *`,
        [storeId, cleanCode, cleanName, cleanCategory, cleanUnit, numCost, numStock, numMin]
      );
      newItem = result.rows[0];

      if (numStock > 0) {
        const transCode = `PN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(newItem.id).padStart(4, '0')}`;
        await pool.query(
          `INSERT INTO inventory_transactions (transaction_code, store_id, item_id, transaction_type, quantity, price, total_amount, stock_before, stock_after, user_id, note)
           VALUES ($1, $2, $3, 'IN', $4, $5, $6, 0, $4, $7, 'Khởi tạo tồn kho ban đầu')`,
          [transCode, storeId, newItem.id, numStock, numCost, Math.round(numStock * numCost), req.user?.id || null]
        );
      }
    } else {
      if (!memoryStore.inventory_items) memoryStore.inventory_items = [];
      if (!memoryStore.inventory_transactions) memoryStore.inventory_transactions = [];

      const exists = memoryStore.inventory_items.some(i => i.store_id === storeId && i.code === cleanCode);
      if (exists) {
        return res.status(400).json({ success: false, message: `Mã mặt hàng "${cleanCode}" đã tồn tại` });
      }

      const nextId = memoryStore.inventory_items.length > 0
        ? Math.max(...memoryStore.inventory_items.map(i => i.id)) + 1
        : 1;

      newItem = {
        id: nextId,
        store_id: storeId,
        code: cleanCode,
        name: cleanName,
        category: cleanCategory,
        unit: cleanUnit,
        cost_price: numCost,
        current_stock: numStock,
        min_stock: numMin,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryStore.inventory_items.push(newItem);

      if (numStock > 0) {
        const nextTransId = memoryStore.inventory_transactions.length > 0
          ? Math.max(...memoryStore.inventory_transactions.map(t => t.id)) + 1
          : 1;
        memoryStore.inventory_transactions.push({
          id: nextTransId,
          transaction_code: `PN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(newItem.id).padStart(4, '0')}`,
          store_id: storeId,
          item_id: newItem.id,
          transaction_type: 'IN',
          quantity: numStock,
          price: numCost,
          total_amount: Math.round(numStock * numCost),
          stock_before: 0,
          stock_after: numStock,
          user_id: req.user?.id || 1,
          note: 'Khởi tạo tồn kho ban đầu',
          created_at: new Date().toISOString()
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Thêm mặt hàng kho thành công',
      item: newItem
    });
  } catch (error) {
    console.error('createItem error:', error);
    res.status(500).json({ success: false, message: 'Lỗi thêm mặt hàng kho' });
  }
}

// 4. Sửa thông tin mặt hàng kho
async function updateItem(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const id = Number(req.params.id);
  const { code, name, category, unit, cost_price, min_stock, is_active, current_stock, import_qty } = req.body;

  try {
    let updatedItem = null;

    if (isPostgresConnected()) {
      const check = await pool.query('SELECT * FROM inventory_items WHERE id = $1 AND store_id = $2', [id, storeId]);
      if (!check.rows.length) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mặt hàng kho' });
      }
      const oldItem = check.rows[0];
      const oldStock = Number(oldItem.current_stock || 0);

      if (code) {
        const cleanCode = String(code).trim().toUpperCase();
        const codeCheck = await pool.query(
          'SELECT id FROM inventory_items WHERE store_id = $1 AND code = $2 AND id <> $3',
          [storeId, cleanCode, id]
        );
        if (codeCheck.rows.length > 0) {
          return res.status(400).json({ success: false, message: `Mã mặt hàng "${cleanCode}" đã trùng với mặt hàng khác` });
        }
      }

      let targetStock = null;
      let addedImportQty = 0;
      if (import_qty !== undefined && Number(import_qty) > 0) {
        addedImportQty = Number(import_qty);
        targetStock = oldStock + addedImportQty;
      } else if (current_stock !== undefined) {
        const parsed = Number(current_stock);
        if (!isNaN(parsed) && parsed >= 0) {
          targetStock = parsed;
          if (targetStock > oldStock) {
            addedImportQty = targetStock - oldStock;
          }
        }
      }

      const result = await pool.query(
        `UPDATE inventory_items
         SET code = COALESCE($1, code),
             name = COALESCE($2, name),
             category = COALESCE($3, category),
             unit = COALESCE($4, unit),
             cost_price = COALESCE($5, cost_price),
             min_stock = COALESCE($6, min_stock),
             is_active = COALESCE($7, is_active),
             current_stock = COALESCE($8, current_stock),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 AND store_id = $10
         RETURNING *`,
        [
          code ? String(code).trim().toUpperCase() : null,
          name ? String(name).trim() : null,
          category ? String(category).trim() : null,
          unit ? String(unit).trim() : null,
          cost_price !== undefined ? Number(cost_price) : null,
          min_stock !== undefined ? Number(min_stock) : null,
          is_active !== undefined ? !!is_active : null,
          targetStock !== null ? targetStock : null,
          id,
          storeId
        ]
      );
      updatedItem = result.rows[0];

      if (addedImportQty > 0) {
        const unitCost = cost_price !== undefined ? Number(cost_price) : Number(oldItem.cost_price || 0);
        const transCode = `PN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        await pool.query(
          `INSERT INTO inventory_transactions (transaction_code, store_id, item_id, transaction_type, quantity, price, total_amount, stock_before, stock_after, user_id, note)
           VALUES ($1, $2, $3, 'IN', $4, $5, $6, $7, $8, $9, $10)`,
          [transCode, storeId, id, addedImportQty, unitCost, Math.round(addedImportQty * unitCost), oldStock, targetStock, req.user?.id || null, 'Cập nhật hàng nhập (Chế độ đơn giản)']
        );
      }
    } else {
      const idx = (memoryStore.inventory_items || []).findIndex(i => i.id === id && i.store_id === storeId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mặt hàng kho' });
      }

      const current = memoryStore.inventory_items[idx];
      const oldStock = Number(current.current_stock || 0);
      if (code && code.trim().toUpperCase() !== current.code) {
        const cleanCode = code.trim().toUpperCase();
        const exists = memoryStore.inventory_items.some(i => i.store_id === storeId && i.code === cleanCode && i.id !== id);
        if (exists) {
          return res.status(400).json({ success: false, message: `Mã mặt hàng "${cleanCode}" đã trùng với mặt hàng khác` });
        }
        current.code = cleanCode;
      }

      if (name) current.name = String(name).trim();
      if (category) current.category = String(category).trim();
      if (unit) current.unit = String(unit).trim();
      if (cost_price !== undefined) current.cost_price = Number(cost_price);
      if (min_stock !== undefined) current.min_stock = Number(min_stock);
      if (is_active !== undefined) current.is_active = !!is_active;

      let addedImportQty = 0;
      if (import_qty !== undefined && Number(import_qty) > 0) {
        addedImportQty = Number(import_qty);
        current.current_stock = oldStock + addedImportQty;
      } else if (current_stock !== undefined) {
        const parsed = Number(current_stock);
        if (!isNaN(parsed) && parsed >= 0) {
          if (parsed > oldStock) {
            addedImportQty = parsed - oldStock;
          }
          current.current_stock = parsed;
        }
      }
      current.updated_at = new Date().toISOString();
      updatedItem = current;

      if (addedImportQty > 0) {
        if (!memoryStore.inventory_transactions) memoryStore.inventory_transactions = [];
        const nextId = memoryStore.inventory_transactions.length > 0
          ? Math.max(...memoryStore.inventory_transactions.map(t => t.id)) + 1
          : 1;
        const unitCost = current.cost_price || 0;
        memoryStore.inventory_transactions.push({
          id: nextId,
          transaction_code: `PN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
          store_id: storeId,
          item_id: id,
          transaction_type: 'IN',
          quantity: addedImportQty,
          price: unitCost,
          total_amount: Math.round(addedImportQty * unitCost),
          stock_before: oldStock,
          stock_after: current.current_stock,
          user_id: req.user?.id || 1,
          note: 'Cập nhật hàng nhập (Chế độ đơn giản)',
          created_at: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Cập nhật mặt hàng kho thành công',
      item: updatedItem
    });
  } catch (error) {
    console.error('updateItem error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật mặt hàng kho' });
  }
}

// 5. Xóa mặt hàng kho
async function deleteItem(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const id = Number(req.params.id);

  try {
    if (isPostgresConnected()) {
      const transCheck = await pool.query('SELECT 1 FROM inventory_transactions WHERE item_id = $1 LIMIT 1', [id]);
      if (transCheck.rows.length > 0) {
        await pool.query('UPDATE inventory_items SET is_active = FALSE WHERE id = $1 AND store_id = $2', [id, storeId]);
      } else {
        await pool.query('DELETE FROM inventory_items WHERE id = $1 AND store_id = $2', [id, storeId]);
      }
    } else {
      const idx = (memoryStore.inventory_items || []).findIndex(i => i.id === id && i.store_id === storeId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mặt hàng kho' });
      }
      const hasTrans = (memoryStore.inventory_transactions || []).some(t => t.item_id === id);
      if (hasTrans) {
        memoryStore.inventory_items[idx].is_active = false;
      } else {
        memoryStore.inventory_items.splice(idx, 1);
      }
    }

    res.json({ success: true, message: 'Đã xóa mặt hàng kho thành công' });
  } catch (error) {
    console.error('deleteItem error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xóa mặt hàng kho' });
  }
}

// 6. Tạo phiếu giao dịch kho (Nhập kho, Xuất kho, Kiểm kê điều chỉnh)
async function createTransaction(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const itemId = Number(req.body.item_id || req.body.itemId);
  const type = String(req.body.transaction_type || req.body.type || 'IN').toUpperCase();
  const quantity = req.body.quantity !== undefined ? req.body.quantity : req.body.qty;
  const price = req.body.price !== undefined ? req.body.price : req.body.unit_price;
  const note = req.body.note || req.body.reason || req.body.notes || '';
  const new_stock = req.body.new_stock;

  if (!['IN', 'OUT', 'ADJUST'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Loại phiếu không hợp lệ (hỗ trợ IN, OUT, ADJUST)' });
  }

  try {
    const transactionsEnabled = await getStoreInventoryTransactionsEnabled(storeId);
    if (!transactionsEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Cửa hàng đang ở chế độ Quản lý kho đơn giản (đã tắt Nghiệp vụ Phiếu kho). Bạn có thể chỉnh sửa tồn kho hoặc nhập thêm hàng trực tiếp trong Danh mục mặt hàng.'
      });
    }

    const allowNegative = await getStoreAllowNegativeStock(storeId);
    let item = null;
    let transaction = null;

    if (isPostgresConnected()) {
      const itemRes = await pool.query('SELECT * FROM inventory_items WHERE id = $1 AND store_id = $2', [itemId, storeId]);
      if (!itemRes.rows.length) {
        return res.status(404).json({ success: false, message: 'Mặt hàng kho không tồn tại' });
      }
      item = itemRes.rows[0];

      const currentStock = Number(item.current_stock || 0);
      let qty = Number(quantity || 0);
      let stockAfter = currentStock;

      if (type === 'IN') {
        if (qty <= 0) return res.status(400).json({ success: false, message: 'Số lượng nhập phải lớn hơn 0' });
        stockAfter = currentStock + qty;
      } else if (type === 'OUT') {
        if (qty <= 0) return res.status(400).json({ success: false, message: 'Số lượng xuất phải lớn hơn 0' });
        if (!allowNegative && currentStock < qty) {
          return res.status(400).json({
            success: false,
            message: `Không đủ tồn kho để xuất. Hiện còn: ${currentStock} ${item.unit}, yêu cầu xuất: ${qty} ${item.unit}`
          });
        }
        stockAfter = currentStock - qty;
      } else if (type === 'ADJUST') {
        const targetStock = new_stock !== undefined ? Number(new_stock) : Number(quantity);
        if (isNaN(targetStock) || targetStock < 0) {
          return res.status(400).json({ success: false, message: 'Số lượng tồn kiểm kê thực tế không hợp lệ' });
        }
        qty = Math.abs(targetStock - currentStock);
        stockAfter = targetStock;
      }

      const unitPrice = price !== undefined ? Number(price) : Number(item.cost_price || 0);
      const totalAmount = Math.round(qty * unitPrice);
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = type === 'IN' ? 'PN' : (type === 'OUT' ? 'PX' : 'DC');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const transCode = `${prefix}-${datePrefix}-${randomSuffix}`;

      const transRes = await pool.query(
        `INSERT INTO inventory_transactions 
         (transaction_code, store_id, item_id, transaction_type, quantity, price, total_amount, stock_before, stock_after, user_id, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [transCode, storeId, itemId, type, qty, unitPrice, totalAmount, currentStock, stockAfter, req.user?.id || null, note || '']
      );
      transaction = transRes.rows[0];

      let updateSql = 'UPDATE inventory_items SET current_stock = $1, updated_at = CURRENT_TIMESTAMP';
      const updateParams = [stockAfter];
      if (type === 'IN' && unitPrice > 0) {
        updateSql += ', cost_price = $2 WHERE id = $3';
        updateParams.push(unitPrice, itemId);
      } else {
        updateSql += ' WHERE id = $2';
        updateParams.push(itemId);
      }
      await pool.query(updateSql, updateParams);
      item.current_stock = stockAfter;
    } else {
      const idx = (memoryStore.inventory_items || []).findIndex(i => i.id === itemId && i.store_id === storeId);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'Mặt hàng kho không tồn tại' });
      }
      item = memoryStore.inventory_items[idx];

      const currentStock = Number(item.current_stock || 0);
      let qty = Number(quantity || 0);
      let stockAfter = currentStock;

      if (type === 'IN') {
        if (qty <= 0) return res.status(400).json({ success: false, message: 'Số lượng nhập phải lớn hơn 0' });
        stockAfter = currentStock + qty;
      } else if (type === 'OUT') {
        if (qty <= 0) return res.status(400).json({ success: false, message: 'Số lượng xuất phải lớn hơn 0' });
        if (!allowNegative && currentStock < qty) {
          return res.status(400).json({
            success: false,
            message: `Không đủ tồn kho để xuất. Hiện còn: ${currentStock} ${item.unit}, yêu cầu xuất: ${qty} ${item.unit}`
          });
        }
        stockAfter = currentStock - qty;
      } else if (type === 'ADJUST') {
        const targetStock = new_stock !== undefined ? Number(new_stock) : Number(quantity);
        if (isNaN(targetStock) || targetStock < 0) {
          return res.status(400).json({ success: false, message: 'Số lượng tồn kiểm kê thực tế không hợp lệ' });
        }
        qty = Math.abs(targetStock - currentStock);
        stockAfter = targetStock;
      }

      const unitPrice = price !== undefined ? Number(price) : Number(item.cost_price || 0);
      const totalAmount = Math.round(qty * unitPrice);
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = type === 'IN' ? 'PN' : (type === 'OUT' ? 'PX' : 'DC');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const transCode = `${prefix}-${datePrefix}-${randomSuffix}`;

      if (!memoryStore.inventory_transactions) memoryStore.inventory_transactions = [];
      const nextId = memoryStore.inventory_transactions.length > 0
        ? Math.max(...memoryStore.inventory_transactions.map(t => t.id)) + 1
        : 1;

      transaction = {
        id: nextId,
        transaction_code: transCode,
        store_id: storeId,
        item_id: itemId,
        transaction_type: type,
        quantity: qty,
        price: unitPrice,
        total_amount: totalAmount,
        stock_before: currentStock,
        stock_after: stockAfter,
        user_id: req.user?.id || 1,
        note: note || '',
        created_at: new Date().toISOString()
      };
      memoryStore.inventory_transactions.push(transaction);

      item.current_stock = stockAfter;
      if (type === 'IN' && unitPrice > 0) item.cost_price = unitPrice;
      item.updated_at = new Date().toISOString();
    }

    const typeName = type === 'IN' ? 'Nhập kho' : (type === 'OUT' ? 'Xuất kho' : 'Cân bằng kiểm kê');
    res.status(201).json({
      success: true,
      message: `Lập phiếu ${typeName} thành công (Mã: ${transaction.transaction_code})`,
      transaction,
      current_stock: item.current_stock,
      new_stock: item.current_stock
    });
  } catch (error) {
    console.error('createTransaction error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lập phiếu kho' });
  }
}

// 7. Lịch sử giao dịch kho
async function getTransactions(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const { startDate, endDate, item_id, type, limit } = req.query;

  try {
    let transactions = [];

    if (isPostgresConnected()) {
      let query = `
        SELECT t.*, i.name as item_name, i.code as item_code, i.unit as item_unit, i.category as item_category, u.full_name as user_name
        FROM inventory_transactions t
        JOIN inventory_items i ON t.item_id = i.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.store_id = $1
      `;
      const params = [storeId];
      let pIdx = 2;

      if (startDate && endDate) {
        query += ` AND t.created_at >= $${pIdx++} AND t.created_at <= $${pIdx++}`;
        params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
      }
      if (item_id) {
        query += ` AND t.item_id = $${pIdx++}`;
        params.push(Number(item_id));
      }
      if (type) {
        query += ` AND t.transaction_type = $${pIdx++}`;
        params.push(type.toUpperCase());
      }

      query += ` ORDER BY t.created_at DESC LIMIT ${parseInt(limit, 10) || 100}`;
      const result = await pool.query(query, params);
      transactions = result.rows;
    } else {
      const itemsMap = new Map((memoryStore.inventory_items || []).map(i => [i.id, i]));
      const usersMap = new Map((memoryStore.users || []).map(u => [u.id, u]));

      transactions = (memoryStore.inventory_transactions || [])
        .filter(t => {
          if (t.store_id !== storeId) return false;
          if (item_id && t.item_id !== Number(item_id)) return false;
          if (type && t.transaction_type !== type.toUpperCase()) return false;
          if (startDate && endDate) {
            const dt = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '';
            if (dt < startDate || dt > endDate) return false;
          }
          return true;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, parseInt(limit, 10) || 100)
        .map(t => {
          const item = itemsMap.get(t.item_id);
          const user = usersMap.get(t.user_id);
          return {
            ...t,
            item_name: item?.name || 'Mặt hàng đã xóa',
            item_code: item?.code || '-',
            item_unit: item?.unit || '',
            item_category: item?.category || '',
            user_name: user?.full_name || 'Hệ thống'
          };
        });
    }

    res.json({ success: true, transactions });
  } catch (error) {
    console.error('getTransactions error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy lịch sử giao dịch kho' });
  }
}

// 8. Báo cáo tổng hợp tồn kho (Summary)
async function getSummary(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);

  try {
    let items = [];

    if (isPostgresConnected()) {
      const result = await pool.query(
        `SELECT id, store_id, code, name, category, unit, cost_price, current_stock, min_stock, is_active
         FROM inventory_items
         WHERE store_id = $1 AND is_active = TRUE
         ORDER BY category ASC, name ASC`,
        [storeId]
      );
      items = result.rows.map(item => ({
        ...item,
        cost_price: Number(item.cost_price || 0),
        current_stock: Number(item.current_stock || 0),
        min_stock: Number(item.min_stock || 0)
      }));
    } else {
      items = (memoryStore.inventory_items || [])
        .filter(item => item.store_id === storeId && item.is_active)
        .map(item => ({
          ...item,
          cost_price: Number(item.cost_price || 0),
          current_stock: Number(item.current_stock || 0),
          min_stock: Number(item.min_stock || 0)
        }));
    }

    let totalItems = items.length;
    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const categoryStats = {};
    const lowStockAlerts = [];

    items.forEach(item => {
      const value = Math.round(item.current_stock * item.cost_price);
      totalStockValue += value;
      item.total_value = value;

      const cat = item.category || 'Chưa phân loại';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { category: cat, itemCount: 0, totalValue: 0 };
      }
      categoryStats[cat].itemCount += 1;
      categoryStats[cat].totalValue += value;

      if (item.current_stock <= 0) {
        outOfStockCount++;
        lowStockAlerts.push({ ...item, alert_type: 'OUT_OF_STOCK' });
      } else if (item.current_stock <= item.min_stock) {
        lowStockCount++;
        lowStockAlerts.push({ ...item, alert_type: 'LOW_STOCK' });
      }
    });

    const transactionsEnabled = await getStoreInventoryTransactionsEnabled(storeId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    const currentMonthLabel = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    let monthlyImportQty = 0;
    let monthlyImportValue = 0;
    let monthlyImportCount = 0;

    if (isPostgresConnected()) {
      const monthRes = await pool.query(
        `SELECT COALESCE(SUM(quantity), 0) as total_qty, COALESCE(SUM(total_amount), 0) as total_val, COUNT(*) as cnt
         FROM inventory_transactions
         WHERE store_id = $1 AND transaction_type = 'IN' AND created_at >= $2 AND created_at <= $3`,
        [storeId, startOfMonth, endOfMonth]
      );
      if (monthRes.rows.length) {
        monthlyImportQty = Number(monthRes.rows[0].total_qty || 0);
        monthlyImportValue = Number(monthRes.rows[0].total_val || 0);
        monthlyImportCount = Number(monthRes.rows[0].cnt || 0);
      }
    } else {
      const inTrans = (memoryStore.inventory_transactions || []).filter(t =>
        t.store_id === storeId && t.transaction_type === 'IN' && t.created_at >= startOfMonth && t.created_at <= endOfMonth
      );
      inTrans.forEach(t => {
        monthlyImportQty += Number(t.quantity || 0);
        monthlyImportValue += Number(t.total_amount || (Number(t.quantity || 0) * Number(t.price || 0)));
      });
      monthlyImportCount = inTrans.length;
    }

    res.json({
      success: true,
      summary: {
        totalItems,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
        inventory_transactions_enabled: transactionsEnabled,
        monthly_imports: {
          month: currentMonthLabel,
          totalQty: Math.round(monthlyImportQty * 100) / 100,
          totalValue: Math.round(monthlyImportValue),
          count: monthlyImportCount
        },
        categories: Object.values(categoryStats),
        lowStockAlerts,
        items
      }
    });
  } catch (error) {
    console.error('getSummary inventory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy tổng hợp tồn kho' });
  }
}

// 9. Thống kê theo từ ngày đến ngày (Date-Range Report: Nhập - Xuất - Tồn)
async function getReports(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const now = new Date();
  let defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  let defaultEnd = now.toISOString().slice(0, 10);

  if (req.query.month) {
    const parts = req.query.month.split('-');
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      defaultStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
      defaultEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    }
  }

  const startDate = req.query.startDate || defaultStart;
  const endDate = req.query.endDate || defaultEnd;

  try {
    let items = [];
    let transactionsInPeriod = [];

    if (isPostgresConnected()) {
      const resItems = await pool.query(
        'SELECT * FROM inventory_items WHERE store_id = $1 AND is_active = TRUE ORDER BY category ASC, name ASC',
        [storeId]
      );
      items = resItems.rows.map(i => ({
        ...i,
        cost_price: Number(i.cost_price || 0),
        current_stock: Number(i.current_stock || 0),
        min_stock: Number(i.min_stock || 0)
      }));

      const resInPeriod = await pool.query(
        `SELECT t.*, i.name as item_name, i.code as item_code, i.unit as item_unit, i.category as item_category
         FROM inventory_transactions t
         JOIN inventory_items i ON t.item_id = i.id
         WHERE t.store_id = $1 AND t.created_at >= $2 AND t.created_at <= $3
         ORDER BY t.created_at ASC`,
        [storeId, `${startDate} 00:00:00`, `${endDate} 23:59:59`]
      );
      transactionsInPeriod = resInPeriod.rows;
    } else {
      items = (memoryStore.inventory_items || [])
        .filter(i => i.store_id === storeId && i.is_active)
        .map(i => ({
          ...i,
          cost_price: Number(i.cost_price || 0),
          current_stock: Number(i.current_stock || 0),
          min_stock: Number(i.min_stock || 0)
        }));

      const itemsMap = new Map(items.map(i => [i.id, i]));

      (memoryStore.inventory_transactions || [])
        .filter(t => t.store_id === storeId)
        .forEach(t => {
          const dt = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '';
          const item = itemsMap.get(t.item_id);
          const tWithItem = {
            ...t,
            item_name: item?.name || 'Mặt hàng đã xóa',
            item_code: item?.code || '-',
            item_unit: item?.unit || '',
            item_category: item?.category || ''
          };

          if (dt >= startDate && dt <= endDate) {
            transactionsInPeriod.push(tWithItem);
          }
        });
    }

    let totalImportQty = 0;
    let totalImportValue = 0;
    let totalExportQty = 0;
    let totalExportValue = 0;
    let adjustCount = 0;

    const itemTurnoverMap = {};
    items.forEach(item => {
      itemTurnoverMap[item.id] = {
        item_id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        cost_price: item.cost_price,
        initial_stock: 0,
        in_qty: 0,
        in_value: 0,
        out_qty: 0,
        out_value: 0,
        adjust_qty: 0,
        final_stock: 0,
        final_value: 0
      };
    });

    const netChangeInPeriodMap = {};

    transactionsInPeriod.forEach(t => {
      const itemId = t.item_id;
      const qty = Number(t.quantity || 0);
      const price = Number(t.price || 0);
      const amount = Number(t.total_amount || (qty * price));

      if (!netChangeInPeriodMap[itemId]) netChangeInPeriodMap[itemId] = 0;

      const record = itemTurnoverMap[itemId];

      if (t.transaction_type === 'IN') {
        totalImportQty += qty;
        totalImportValue += amount;
        netChangeInPeriodMap[itemId] += qty;
        if (record) {
          record.in_qty += qty;
          record.in_value += amount;
        }
      } else if (t.transaction_type === 'OUT') {
        totalExportQty += qty;
        totalExportValue += amount;
        netChangeInPeriodMap[itemId] -= qty;
        if (record) {
          record.out_qty += qty;
          record.out_value += amount;
        }
      } else if (t.transaction_type === 'ADJUST') {
        adjustCount++;
        const change = Number(t.stock_after || 0) - Number(t.stock_before || 0);
        netChangeInPeriodMap[itemId] += change;
        if (record) {
          record.adjust_qty += change;
        }
      }
    });

    items.forEach(item => {
      const record = itemTurnoverMap[item.id];
      if (!record) return;

      const netChangeInPeriod = netChangeInPeriodMap[item.id] || 0;
      let initialStock = Math.max(0, item.current_stock - netChangeInPeriod);
      record.initial_stock = Math.round(initialStock * 100) / 100;
      record.final_stock = Math.round((record.initial_stock + record.in_qty - record.out_qty + record.adjust_qty) * 100) / 100;
      record.final_value = Math.round(record.final_stock * record.cost_price);
    });

    const dailyMap = {};
    transactionsInPeriod.forEach(t => {
      const day = t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '';
      if (!day) return;
      if (!dailyMap[day]) {
        dailyMap[day] = { date: day, in_qty: 0, in_value: 0, out_qty: 0, out_value: 0, trans_count: 0 };
      }
      dailyMap[day].trans_count += 1;
      const qty = Number(t.quantity || 0);
      const amount = Number(t.total_amount || 0);
      if (t.transaction_type === 'IN') {
        dailyMap[day].in_qty += qty;
        dailyMap[day].in_value += amount;
      } else if (t.transaction_type === 'OUT') {
        dailyMap[day].out_qty += qty;
        dailyMap[day].out_value += amount;
      }
    });

    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    const transactionsEnabled = await getStoreInventoryTransactionsEnabled(storeId);

    res.json({
      success: true,
      report: {
        startDate,
        endDate,
        inventory_transactions_enabled: transactionsEnabled,
        summary: {
          totalImportQty: Math.round(totalImportQty * 100) / 100,
          totalImportValue,
          totalExportQty: Math.round(totalExportQty * 100) / 100,
          totalExportValue,
          adjustCount,
          netQtyChange: Math.round((totalImportQty - totalExportQty) * 100) / 100,
          netValueChange: totalImportValue - totalExportValue
        },
        itemsTurnover: Object.values(itemTurnoverMap),
        dailyBreakdown,
        transactions: transactionsInPeriod.slice().reverse()
      }
    });
  } catch (error) {
    console.error('getReports inventory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy báo cáo thống kê kho' });
  }
}

module.exports = {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  createTransaction,
  getTransactions,
  getSummary,
  getReports
};
