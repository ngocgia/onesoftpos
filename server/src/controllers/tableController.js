const { pool, isPostgresConnected, memoryStore } = require('../config/db');

async function getAreas(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  try {
    let areas = [];
    if (isPostgresConnected()) {
      const result = await pool.query(
        'SELECT * FROM areas WHERE store_id = $1 AND is_active = TRUE ORDER BY sort_order ASC, id ASC',
        [storeId]
      );
      areas = result.rows;
    } else {
      areas = memoryStore.areas
        .filter(a => a.store_id === storeId && a.is_active)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
    res.json({ success: true, areas });
  } catch (error) {
    console.error('getAreas error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách khu vực' });
  }
}

async function getTables(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  try {
    let tables = [];
    if (isPostgresConnected()) {
      const result = await pool.query(
        `SELECT t.*, a.name as area_name, o.order_code, o.total_amount, o.created_at as order_time 
         FROM tables t 
         LEFT JOIN areas a ON t.area_id = a.id 
         LEFT JOIN orders o ON t.current_order_id = o.id 
         WHERE t.store_id = $1 
         ORDER BY t.sort_order ASC, t.id ASC`,
        [storeId]
      );
      tables = result.rows;
    } else {
      tables = memoryStore.tables
        .filter(t => t.store_id === storeId)
        .map(t => {
          const area = memoryStore.areas.find(a => a.id === t.area_id);
          const order = t.current_order_id ? memoryStore.orders.find(o => o.id === t.current_order_id) : null;
          return {
            ...t,
            area_name: area ? area.name : '',
            order_code: order ? order.order_code : null,
            total_amount: order ? order.total_amount : 0,
            order_time: order ? order.created_at : null
          };
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    res.json({ success: true, tables });
  } catch (error) {
    console.error('getTables error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách bàn' });
  }
}

async function createArea(req, res) {
  const storeId = req.storeId;
  const name = String(req.body.name || '').trim();
  const sortOrder = Number(req.body.sort_order) || 0;
  if (!name) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên khu vực/phòng' });
  try {
    let area;
    if (isPostgresConnected()) {
      const result = await pool.query(`INSERT INTO areas (store_id,name,sort_order,is_active)
        VALUES ($1,$2,$3,TRUE) RETURNING *`, [storeId, name, sortOrder]);
      area = result.rows[0];
    } else {
      const id = memoryStore.areas.length ? Math.max(...memoryStore.areas.map(item => item.id)) + 1 : 1;
      area = { id, store_id: storeId, name, sort_order: sortOrder, is_active: true };
      memoryStore.areas.push(area);
    }
    res.status(201).json({ success: true, message: 'Đã thêm khu vực/phòng', area });
  } catch (error) {
    console.error('createArea error:', error);
    res.status(500).json({ success: false, message: 'Không thể thêm khu vực/phòng' });
  }
}

async function updateArea(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId;
  const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
  const sortOrder = req.body.sort_order === undefined ? undefined : Number(req.body.sort_order) || 0;
  if (name === '') return res.status(400).json({ success: false, message: 'Tên khu vực/phòng không được để trống' });
  try {
    if (isPostgresConnected()) {
      const result = await pool.query(`UPDATE areas SET name=COALESCE($1,name),sort_order=COALESCE($2,sort_order)
        WHERE id=$3 AND store_id=$4 RETURNING *`, [name, sortOrder, id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy khu vực/phòng' });
      return res.json({ success: true, message: 'Đã cập nhật khu vực/phòng', area: result.rows[0] });
    }
    const area = memoryStore.areas.find(item => item.id === id && item.store_id === storeId);
    if (!area) return res.status(404).json({ success: false, message: 'Không tìm thấy khu vực/phòng' });
    if (name !== undefined) area.name = name;
    if (sortOrder !== undefined) area.sort_order = sortOrder;
    res.json({ success: true, message: 'Đã cập nhật khu vực/phòng', area });
  } catch (error) {
    console.error('updateArea error:', error);
    res.status(500).json({ success: false, message: 'Không thể cập nhật khu vực/phòng' });
  }
}

async function deleteArea(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId;
  try {
    if (isPostgresConnected()) {
      const tableCount = await pool.query('SELECT COUNT(*)::int AS count FROM tables WHERE area_id=$1 AND store_id=$2', [id, storeId]);
      if (tableCount.rows[0].count > 0) return res.status(409).json({ success: false, message: 'Hãy xóa hoặc chuyển hết bàn trước khi xóa khu vực/phòng' });
      const result = await pool.query('DELETE FROM areas WHERE id=$1 AND store_id=$2 RETURNING id', [id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy khu vực/phòng' });
    } else {
      if (memoryStore.tables.some(item => item.area_id === id && item.store_id === storeId)) return res.status(409).json({ success: false, message: 'Hãy xóa hoặc chuyển hết bàn trước khi xóa khu vực/phòng' });
      const index = memoryStore.areas.findIndex(item => item.id === id && item.store_id === storeId);
      if (index < 0) return res.status(404).json({ success: false, message: 'Không tìm thấy khu vực/phòng' });
      memoryStore.areas.splice(index, 1);
    }
    res.json({ success: true, message: 'Đã xóa khu vực/phòng' });
  } catch (error) {
    console.error('deleteArea error:', error);
    res.status(500).json({ success: false, message: 'Không thể xóa khu vực/phòng' });
  }
}

async function createTable(req, res) {
  const storeId = req.storeId;
  const areaId = Number(req.body.area_id);
  const code = String(req.body.code || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  const seats = Math.max(1, Number(req.body.seats) || 4);
  const sortOrder = Number(req.body.sort_order) || 0;
  if (!areaId || !code || !name) return res.status(400).json({ success: false, message: 'Vui lòng nhập khu vực, mã bàn và tên bàn' });
  try {
    if (isPostgresConnected()) {
      const area = await pool.query('SELECT 1 FROM areas WHERE id=$1 AND store_id=$2 AND is_active=TRUE', [areaId, storeId]);
      if (!area.rowCount) return res.status(400).json({ success: false, message: 'Khu vực/phòng không hợp lệ' });
      const result = await pool.query(`INSERT INTO tables (store_id,area_id,code,name,seats,status,sort_order)
        VALUES ($1,$2,$3,$4,$5,'EMPTY',$6) RETURNING *`, [storeId, areaId, code, name, seats, sortOrder]);
      return res.status(201).json({ success: true, message: 'Đã thêm bàn', table: result.rows[0] });
    }
    if (!memoryStore.areas.some(item => item.id === areaId && item.store_id === storeId && item.is_active)) return res.status(400).json({ success: false, message: 'Khu vực/phòng không hợp lệ' });
    if (memoryStore.tables.some(item => item.store_id === storeId && item.code === code)) return res.status(409).json({ success: false, message: 'Mã bàn đã tồn tại trong cửa hàng' });
    const id = memoryStore.tables.length ? Math.max(...memoryStore.tables.map(item => item.id)) + 1 : 1;
    const table = { id, store_id: storeId, area_id: areaId, code, name, seats, status: 'EMPTY', current_order_id: null, sort_order: sortOrder };
    memoryStore.tables.push(table);
    res.status(201).json({ success: true, message: 'Đã thêm bàn', table });
  } catch (error) {
    console.error('createTable error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Mã bàn đã tồn tại trong cửa hàng' : 'Không thể thêm bàn' });
  }
}

async function updateTable(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId;
  const areaId = req.body.area_id === undefined ? undefined : Number(req.body.area_id);
  const code = req.body.code === undefined ? undefined : String(req.body.code).trim().toUpperCase();
  const name = req.body.name === undefined ? undefined : String(req.body.name).trim();
  const seats = req.body.seats === undefined ? undefined : Math.max(1, Number(req.body.seats) || 1);
  const sortOrder = req.body.sort_order === undefined ? undefined : Number(req.body.sort_order) || 0;
  if (code === '' || name === '') return res.status(400).json({ success: false, message: 'Mã và tên bàn không được để trống' });
  try {
    if (isPostgresConnected()) {
      if (areaId !== undefined) {
        const area = await pool.query('SELECT 1 FROM areas WHERE id=$1 AND store_id=$2 AND is_active=TRUE', [areaId, storeId]);
        if (!area.rowCount) return res.status(400).json({ success: false, message: 'Khu vực/phòng không hợp lệ' });
      }
      const result = await pool.query(`UPDATE tables SET area_id=COALESCE($1,area_id),code=COALESCE($2,code),
        name=COALESCE($3,name),seats=COALESCE($4,seats),sort_order=COALESCE($5,sort_order)
        WHERE id=$6 AND store_id=$7 RETURNING *`, [areaId, code, name, seats, sortOrder, id, storeId]);
      if (!result.rowCount) return res.status(404).json({ success: false, message: 'Không tìm thấy bàn' });
      return res.json({ success: true, message: 'Đã cập nhật bàn', table: result.rows[0] });
    }
    const table = memoryStore.tables.find(item => item.id === id && item.store_id === storeId);
    if (!table) return res.status(404).json({ success: false, message: 'Không tìm thấy bàn' });
    if (areaId !== undefined && !memoryStore.areas.some(item => item.id === areaId && item.store_id === storeId && item.is_active)) return res.status(400).json({ success: false, message: 'Khu vực/phòng không hợp lệ' });
    if (code !== undefined && memoryStore.tables.some(item => item.id !== id && item.store_id === storeId && item.code === code)) return res.status(409).json({ success: false, message: 'Mã bàn đã tồn tại trong cửa hàng' });
    if (areaId !== undefined) table.area_id = areaId;
    if (code !== undefined) table.code = code;
    if (name !== undefined) table.name = name;
    if (seats !== undefined) table.seats = seats;
    if (sortOrder !== undefined) table.sort_order = sortOrder;
    res.json({ success: true, message: 'Đã cập nhật bàn', table });
  } catch (error) {
    console.error('updateTable error:', error);
    res.status(error.code === '23505' ? 409 : 500).json({ success: false, message: error.code === '23505' ? 'Mã bàn đã tồn tại trong cửa hàng' : 'Không thể cập nhật bàn' });
  }
}

async function deleteTable(req, res) {
  const id = Number(req.params.id);
  const storeId = req.storeId;
  try {
    if (isPostgresConnected()) {
      const result = await pool.query(`DELETE FROM tables WHERE id=$1 AND store_id=$2
        AND status='EMPTY' AND current_order_id IS NULL RETURNING id`, [id, storeId]);
      if (!result.rowCount) {
        const exists = await pool.query('SELECT 1 FROM tables WHERE id=$1 AND store_id=$2', [id, storeId]);
        return res.status(exists.rowCount ? 409 : 404).json({ success: false, message: exists.rowCount ? 'Không thể xóa bàn đang có khách hoặc gắn với đơn hàng' : 'Không tìm thấy bàn' });
      }
    } else {
      const index = memoryStore.tables.findIndex(item => item.id === id && item.store_id === storeId);
      if (index < 0) return res.status(404).json({ success: false, message: 'Không tìm thấy bàn' });
      const table = memoryStore.tables[index];
      if (table.status !== 'EMPTY' || table.current_order_id) return res.status(409).json({ success: false, message: 'Không thể xóa bàn đang có khách hoặc gắn với đơn hàng' });
      memoryStore.tables.splice(index, 1);
    }
    res.json({ success: true, message: 'Đã xóa bàn' });
  } catch (error) {
    console.error('deleteTable error:', error);
    res.status(500).json({ success: false, message: 'Không thể xóa bàn' });
  }
}

async function updateTableStatus(req, res) {
  const tableId = parseInt(req.params.id, 10);
  const storeId = req.storeId;
  const { status } = req.body; // EMPTY, OCCUPIED, RESERVED
  if (!['EMPTY', 'OCCUPIED', 'RESERVED'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái bàn không hợp lệ' });
  }
  if (!storeId) return res.status(400).json({ success: false, message: 'Vui lòng chọn cửa hàng' });

  try {
    if (isPostgresConnected()) {
      const result = await pool.query(`UPDATE tables SET status = $1 WHERE id = $2 AND store_id = $3
        ${req.body.draft ? 'AND current_order_id IS NULL' : ''} RETURNING *`, [status, tableId, storeId]);
      if (!result.rowCount) return res.status(409).json({ success: false, message: 'Bàn không khả dụng hoặc đã có đơn, vui lòng tải lại' });
    } else {
      const table = memoryStore.tables.find(t => t.id === tableId && t.store_id === storeId);
      if (!table) return res.status(404).json({ success: false, message: 'Không tìm thấy bàn' });
      if (req.body.draft && table.current_order_id) return res.status(409).json({ success: false, message: 'Bàn đã có đơn, vui lòng tải lại' });
      table.status = status;
    }
    res.json({ success: true, message: 'Cập nhật trạng thái bàn thành công' });
  } catch (error) {
    console.error('updateTableStatus error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái bàn' });
  }
}

// Rule 22: Chuyển bàn (Bàn A -> Bàn B)
async function transferTable(req, res) {
  const { from_table_id, to_table_id } = req.body;
  if (!from_table_id || !to_table_id) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn bàn nguồn và bàn đích' });
  }

  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const fromRes = await client.query('SELECT * FROM tables WHERE id = $1', [from_table_id]);
        const toRes = await client.query('SELECT * FROM tables WHERE id = $1', [to_table_id]);

        if (fromRes.rows.length === 0 || toRes.rows.length === 0) {
          throw new Error('Không tìm thấy bàn yêu cầu');
        }

        const fromTable = fromRes.rows[0];
        const toTable = toRes.rows[0];

        if (toTable.status === 'OCCUPIED') {
          throw new Error('Bàn đích đang có khách, không thể chuyển sang!');
        }

        const orderId = fromTable.current_order_id;
        if (orderId) {
          await client.query('UPDATE orders SET table_id = $1 WHERE id = $2', [to_table_id, orderId]);
        }

        // Cập nhật trạng thái bàn theo Rule 22
        await client.query('UPDATE tables SET status = $1, current_order_id = NULL WHERE id = $2', ['EMPTY', from_table_id]);
        await client.query('UPDATE tables SET status = $1, current_order_id = $2 WHERE id = $3', ['OCCUPIED', orderId, to_table_id]);

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const fromTable = memoryStore.tables.find(t => t.id === parseInt(from_table_id, 10));
      const toTable = memoryStore.tables.find(t => t.id === parseInt(to_table_id, 10));

      if (!fromTable || !toTable) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy bàn yêu cầu' });
      }
      if (toTable.status === 'OCCUPIED') {
        return res.status(400).json({ success: false, message: 'Bàn đích đang có khách, không thể chuyển!' });
      }

      const orderId = fromTable.current_order_id;
      if (orderId) {
        const order = memoryStore.orders.find(o => o.id === orderId);
        if (order) order.table_id = toTable.id;
      }

      fromTable.status = 'EMPTY';
      fromTable.current_order_id = null;
      toTable.status = 'OCCUPIED';
      toTable.current_order_id = orderId;
    }

    res.json({ success: true, message: 'Chuyển bàn thành công' });
  } catch (error) {
    console.error('transferTable error:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi chuyển bàn' });
  }
}

// Rule 23: Ghép bàn (Ghép bàn A vào bàn B)
async function mergeTables(req, res) {
  const { source_table_id, target_table_id } = req.body;
  if (!source_table_id || !target_table_id) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn bàn cần ghép' });
  }

  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const sRes = await client.query('SELECT * FROM tables WHERE id = $1', [source_table_id]);
        const tRes = await client.query('SELECT * FROM tables WHERE id = $1', [target_table_id]);

        const sourceTable = sRes.rows[0];
        const targetTable = tRes.rows[0];

        if (sourceTable.current_order_id && targetTable.current_order_id) {
          // Gộp các món từ order nguồn sang order đích
          await client.query(
            'UPDATE order_items SET order_id = $1 WHERE order_id = $2',
            [targetTable.current_order_id, sourceTable.current_order_id]
          );

          // Cập nhật lại tổng tiền đơn đích
          const sumRes = await client.query('SELECT SUM(subtotal) as subtotal FROM order_items WHERE order_id = $1', [targetTable.current_order_id]);
          const newSubtotal = sumRes.rows[0].subtotal || 0;
          await client.query('UPDATE orders SET subtotal = $1, total_amount = $1 WHERE id = $2', [newSubtotal, targetTable.current_order_id]);

          // Hủy đơn nguồn đã gộp
          await client.query('UPDATE orders SET order_status = $1 WHERE id = $2', ['CANCELLED', sourceTable.current_order_id]);
        }

        await client.query('UPDATE tables SET status = $1, current_order_id = NULL WHERE id = $2', ['EMPTY', source_table_id]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const sTable = memoryStore.tables.find(t => t.id === parseInt(source_table_id, 10));
      const tTable = memoryStore.tables.find(t => t.id === parseInt(target_table_id, 10));

      if (sTable && tTable && sTable.current_order_id && tTable.current_order_id) {
        const sOrderId = sTable.current_order_id;
        const tOrderId = tTable.current_order_id;

        memoryStore.order_items.forEach(item => {
          if (item.order_id === sOrderId) item.order_id = tOrderId;
        });

        const newItems = memoryStore.order_items.filter(i => i.order_id === tOrderId);
        const newTotal = newItems.reduce((acc, cur) => acc + (cur.subtotal || 0), 0);

        const targetOrder = memoryStore.orders.find(o => o.id === tOrderId);
        if (targetOrder) {
          targetOrder.subtotal = newTotal;
          targetOrder.total_amount = newTotal;
        }

        const sourceOrder = memoryStore.orders.find(o => o.id === sOrderId);
        if (sourceOrder) sourceOrder.order_status = 'CANCELLED';

        sTable.status = 'EMPTY';
        sTable.current_order_id = null;
      }
    }

    res.json({ success: true, message: 'Ghép bàn thành công' });
  } catch (error) {
    console.error('mergeTables error:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi ghép bàn' });
  }
}

module.exports = {
  getAreas,
  getTables,
  createArea,
  updateArea,
  deleteArea,
  createTable,
  updateTable,
  deleteTable,
  updateTableStatus,
  transferTable,
  mergeTables
};
