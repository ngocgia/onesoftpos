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

async function updateTableStatus(req, res) {
  const tableId = parseInt(req.params.id, 10);
  const { status } = req.body; // EMPTY, OCCUPIED, RESERVED

  try {
    if (isPostgresConnected()) {
      await pool.query('UPDATE tables SET status = $1 WHERE id = $2', [status, tableId]);
    } else {
      const table = memoryStore.tables.find(t => t.id === tableId);
      if (table) table.status = status;
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
  updateTableStatus,
  transferTable,
  mergeTables
};
