const { pool, isPostgresConnected, memoryStore } = require('../config/db');

function generateOrderCode() {
  const d = new Date();
  const dateStr = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TG${dateStr}-${rand}`;
}

async function createOrder(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const cashierId = req.user ? req.user.id : null;
  const {
    order_type = 'TAKEAWAY',
    table_id,
    customer_name,
    customer_phone,
    note,
    items = [],
    discount_amount = 0,
    tax_amount = 0
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Đơn hàng phải có ít nhất 1 sản phẩm' });
  }

  const orderCode = generateOrderCode();

  // Calculate totals
  let subtotal = 0;
  items.forEach(item => {
    let itemPrice = parseFloat(item.unit_price) || 0;
    if (item.options && Array.isArray(item.options)) {
      item.options.forEach(opt => {
        itemPrice += parseFloat(opt.price) || 0;
      });
    }
    const itemSubtotal = itemPrice * (item.quantity || 1);
    item.calculatedSubtotal = itemSubtotal;
    subtotal += itemSubtotal;
  });

  const totalAmount = Math.max(0, subtotal - parseFloat(discount_amount || 0) + parseFloat(tax_amount || 0));

  try {
    let createdOrder = null;

    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const orderRes = await client.query(
          `INSERT INTO orders (
            order_code, store_id, order_type, table_id, customer_name, customer_phone,
            cashier_id, subtotal, discount_amount, tax_amount, total_amount,
            payment_status, order_status, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'UNPAID', 'CONFIRMED', $12)
          RETURNING *`,
          [orderCode, storeId, order_type, table_id || null, customer_name, customer_phone, cashierId, subtotal, discount_amount, tax_amount, totalAmount, note]
        );
        createdOrder = orderRes.rows[0];

        // Insert items
        for (let it of items) {
          const itemRes = await client.query(
            `INSERT INTO order_items (
              order_id, product_id, variant_id, product_name, variant_name,
              unit_price, quantity, subtotal, note, status, kitchen_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10)
            RETURNING *`,
            [
              createdOrder.id,
              it.product_id || null,
              it.variant_id || null,
              it.product_name,
              it.variant_name || null,
              it.unit_price,
              it.quantity || 1,
              it.calculatedSubtotal,
              it.note || '',
              it.kitchen_type || 'KITCHEN'
            ]
          );
          const savedItem = itemRes.rows[0];

          // Insert options
          if (it.options && Array.isArray(it.options)) {
            for (let opt of it.options) {
              await client.query(
                `INSERT INTO order_item_options (order_item_id, option_id, option_name, price)
                 VALUES ($1, $2, $3, $4)`,
                [savedItem.id, opt.option_id || null, opt.option_name, opt.price || 0]
              );
            }
          }
        }

        // If dine-in, update table status
        if (order_type === 'DINE_IN' && table_id) {
          await client.query(
            'UPDATE tables SET status = $1, current_order_id = $2 WHERE id = $3',
            ['OCCUPIED', createdOrder.id, table_id]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const orderId = memoryStore.orders.length ? Math.max(...memoryStore.orders.map(o => o.id)) + 1 : 1;
      createdOrder = {
        id: orderId,
        order_code: orderCode,
        store_id: storeId,
        order_type,
        table_id: table_id ? parseInt(table_id, 10) : null,
        customer_name,
        customer_phone,
        cashier_id: cashierId,
        subtotal,
        discount_amount: parseFloat(discount_amount || 0),
        tax_amount: parseFloat(tax_amount || 0),
        total_amount: totalAmount,
        payment_status: 'UNPAID',
        order_status: 'CONFIRMED',
        note,
        created_at: new Date().toISOString()
      };
      memoryStore.orders.unshift(createdOrder);

      items.forEach((it, idx) => {
        const itemId = memoryStore.order_items.length + idx + 1;
        const savedItem = {
          id: itemId,
          order_id: orderId,
          product_id: it.product_id,
          variant_id: it.variant_id,
          product_name: it.product_name,
          variant_name: it.variant_name,
          unit_price: it.unit_price,
          quantity: it.quantity || 1,
          subtotal: it.calculatedSubtotal,
          note: it.note || '',
          status: 'PENDING',
          kitchen_type: it.kitchen_type || 'KITCHEN'
        };
        memoryStore.order_items.push(savedItem);

        if (it.options && Array.isArray(it.options)) {
          it.options.forEach((opt, optIdx) => {
            memoryStore.order_item_options.push({
              id: memoryStore.order_item_options.length + optIdx + 1,
              order_item_id: itemId,
              option_id: opt.option_id,
              option_name: opt.option_name,
              price: opt.price || 0
            });
          });
        }
      });

      if (order_type === 'DINE_IN' && table_id) {
        const t = memoryStore.tables.find(tbl => tbl.id === parseInt(table_id, 10));
        if (t) {
          t.status = 'OCCUPIED';
          t.current_order_id = orderId;
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Tạo đơn hàng thành công',
      order: createdOrder
    });
  } catch (error) {
    console.error('createOrder error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo đơn hàng: ' + error.message });
  }
}

async function getOrders(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const status = req.query.status;

  try {
    let orders = [];
    if (isPostgresConnected()) {
      let queryStr = `
        SELECT o.*, t.name as table_name, t.code as table_code, u.full_name as cashier_name,
               COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        LEFT JOIN users u ON o.cashier_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.store_id = $1
      `;
      const params = [storeId];
      if (status) {
        queryStr += ' AND o.order_status = $2';
        params.push(status);
      }
      queryStr += ' GROUP BY o.id, t.name, t.code, u.full_name ORDER BY o.created_at DESC LIMIT 50';

      const result = await pool.query(queryStr, params);
      orders = result.rows;
    } else {
      let list = memoryStore.orders.filter(o => o.store_id === storeId);
      if (status) {
        list = list.filter(o => o.order_status === status);
      }
      orders = list.map(o => {
        const table = memoryStore.tables.find(t => t.id === o.table_id);
        const cashier = memoryStore.users.find(u => u.id === o.cashier_id);
        const itemCount = memoryStore.order_items.filter(i => i.order_id === o.id).length;
        return {
          ...o,
          table_name: table ? table.name : null,
          table_code: table ? table.code : null,
          cashier_name: cashier ? cashier.full_name : null,
          item_count: itemCount
        };
      });
    }

    res.json({ success: true, orders });
  } catch (error) {
    console.error('getOrders error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đơn hàng' });
  }
}

async function getOrderById(req, res) {
  const orderId = parseInt(req.params.id, 10);

  try {
    let order = null;
    let items = [];
    let payments = [];

    if (isPostgresConnected()) {
      const orderRes = await pool.query(
        `SELECT o.*, t.name as table_name, t.code as table_code, u.full_name as cashier_name
         FROM orders o
         LEFT JOIN tables t ON o.table_id = t.id
         LEFT JOIN users u ON o.cashier_id = u.id
         WHERE o.id = $1`,
        [orderId]
      );
      if (orderRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      }
      order = orderRes.rows[0];

      const itemRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [orderId]);
      items = itemRes.rows;

      for (let item of items) {
        const optRes = await pool.query('SELECT * FROM order_item_options WHERE order_item_id = $1', [item.id]);
        item.options = optRes.rows;
      }

      const payRes = await pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);
      payments = payRes.rows;
    } else {
      order = memoryStore.orders.find(o => o.id === orderId);
      if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

      const table = memoryStore.tables.find(t => t.id === order.table_id);
      const cashier = memoryStore.users.find(u => u.id === order.cashier_id);
      order = {
        ...order,
        table_name: table ? table.name : null,
        table_code: table ? table.code : null,
        cashier_name: cashier ? cashier.full_name : null
      };

      items = memoryStore.order_items.filter(i => i.order_id === orderId).map(i => {
        return {
          ...i,
          options: memoryStore.order_item_options.filter(o => o.order_item_id === i.id)
        };
      });

      payments = memoryStore.payments.filter(p => p.order_id === orderId);
    }

    res.json({ success: true, order, items, payments });
  } catch (error) {
    console.error('getOrderById error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết đơn hàng' });
  }
}

async function updateOrderStatus(req, res) {
  const orderId = parseInt(req.params.id, 10);
  const { status } = req.body;

  try {
    if (isPostgresConnected()) {
      await pool.query('UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, orderId]);
    } else {
      const order = memoryStore.orders.find(o => o.id === orderId);
      if (order) order.order_status = status;
    }

    res.json({ success: true, message: 'Cập nhật trạng thái đơn thành công' });
  } catch (error) {
    console.error('updateOrderStatus error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái đơn' });
  }
}

// Rule 24: Tách hóa đơn
async function splitOrder(req, res) {
  const orderId = parseInt(req.params.id, 10);
  const { item_ids = [] } = req.body; // array of order_item_id to split off

  if (!item_ids.length) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn các món cần tách' });
  }

  try {
    const newOrderCode = generateOrderCode();
    let newOrder = null;

    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const origRes = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        const original = origRes.rows[0];

        // Create new order
        const newOrderRes = await client.query(
          `INSERT INTO orders (
            order_code, store_id, order_type, table_id, customer_name, customer_phone,
            cashier_id, subtotal, total_amount, payment_status, order_status, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0, 'UNPAID', 'CONFIRMED', $8)
          RETURNING *`,
          [newOrderCode, original.store_id, original.order_type, original.table_id, original.customer_name, original.customer_phone, original.cashier_id, 'Tách từ đơn ' + original.order_code]
        );
        newOrder = newOrderRes.rows[0];

        // Move items to new order
        for (let itemId of item_ids) {
          await client.query('UPDATE order_items SET order_id = $1 WHERE id = $2', [newOrder.id, itemId]);
        }

        // Recalculate subtotals for both orders
        const sumNew = await client.query('SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE order_id = $1', [newOrder.id]);
        await client.query('UPDATE orders SET subtotal = $1, total_amount = $1 WHERE id = $2', [sumNew.rows[0].total, newOrder.id]);

        const sumOrig = await client.query('SELECT COALESCE(SUM(subtotal), 0) as total FROM order_items WHERE order_id = $1', [original.id]);
        await client.query('UPDATE orders SET subtotal = $1, total_amount = $1 WHERE id = $2', [sumOrig.rows[0].total, original.id]);

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const original = memoryStore.orders.find(o => o.id === orderId);
      if (!original) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng gốc' });

      const newId = memoryStore.orders.length ? Math.max(...memoryStore.orders.map(o => o.id)) + 1 : 1;
      newOrder = {
        ...original,
        id: newId,
        order_code: newOrderCode,
        note: 'Tách từ đơn ' + original.order_code,
        payment_status: 'UNPAID'
      };
      memoryStore.orders.unshift(newOrder);

      memoryStore.order_items.forEach(item => {
        if (item_ids.includes(item.id)) {
          item.order_id = newId;
        }
      });

      // Recalculate totals
      const newItems = memoryStore.order_items.filter(i => i.order_id === newId);
      newOrder.subtotal = newItems.reduce((acc, cur) => acc + (cur.subtotal || 0), 0);
      newOrder.total_amount = newOrder.subtotal;

      const origItems = memoryStore.order_items.filter(i => i.order_id === original.id);
      original.subtotal = origItems.reduce((acc, cur) => acc + (cur.subtotal || 0), 0);
      original.total_amount = original.subtotal;
    }

    res.json({ success: true, message: 'Tách hóa đơn thành công', newOrder });
  } catch (error) {
    console.error('splitOrder error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tách hóa đơn: ' + error.message });
  }
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  splitOrder
};
