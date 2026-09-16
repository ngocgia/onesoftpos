const { pool, isPostgresConnected, memoryStore } = require('../config/db');

async function getKdsOrders(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const kitchenType = req.query.kitchen_type; // 'KITCHEN', 'BAR', or null

  try {
    let activeOrders = [];

    if (isPostgresConnected()) {
      let queryStr = `
        SELECT o.id, o.order_code, o.order_type, o.created_at, o.note as order_note,
               t.name as table_name, t.code as table_code
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.id
        WHERE o.store_id = $1 
          AND o.order_status IN ('CONFIRMED', 'PREPARING')
        ORDER BY o.created_at ASC
      `;
      const oRes = await pool.query(queryStr, [storeId]);
      activeOrders = oRes.rows;

      for (let ord of activeOrders) {
        let itemQuery = `
          SELECT oi.*, p.image_url 
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = $1 AND oi.status NOT IN ('SERVED', 'CANCELLED')
        `;
        const itemParams = [ord.id];
        if (kitchenType) {
          itemQuery += ' AND oi.kitchen_type = $2';
          itemParams.push(kitchenType);
        }
        itemQuery += ' ORDER BY oi.id ASC';

        const itemRes = await pool.query(itemQuery, itemParams);
        ord.items = itemRes.rows;

        for (let item of ord.items) {
          const optRes = await pool.query('SELECT * FROM order_item_options WHERE order_item_id = $1', [item.id]);
          item.options = optRes.rows;
        }
      }

      // Filter out orders that have 0 items for this kitchen_type
      activeOrders = activeOrders.filter(o => o.items && o.items.length > 0);
    } else {
      const orders = memoryStore.orders
        .filter(o => o.store_id === storeId && ['CONFIRMED', 'PREPARING'].includes(o.order_status))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      activeOrders = orders.map(ord => {
        const table = memoryStore.tables.find(t => t.id === ord.table_id);
        let items = memoryStore.order_items.filter(
          i => i.order_id === ord.id && !['SERVED', 'CANCELLED'].includes(i.status)
        );

        if (kitchenType) {
          items = items.filter(i => i.kitchen_type === kitchenType);
        }

        const enrichedItems = items.map(item => {
          const prod = memoryStore.products.find(p => p.id === item.product_id);
          return {
            ...item,
            image_url: prod ? prod.image_url : '🍗',
            options: memoryStore.order_item_options.filter(o => o.order_item_id === item.id)
          };
        });

        return {
          ...ord,
          table_name: table ? table.name : null,
          table_code: table ? table.code : null,
          items: enrichedItems
        };
      }).filter(o => o.items.length > 0);
    }

    res.json({ success: true, orders: activeOrders });
  } catch (error) {
    console.error('getKdsOrders error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu KDS' });
  }
}

async function updateKdsItemStatus(req, res) {
  const itemId = parseInt(req.params.itemId, 10);
  const { status } = req.body; // PENDING, PREPARING, READY, SERVED

  try {
    if (isPostgresConnected()) {
      await pool.query('UPDATE order_items SET status = $1 WHERE id = $2', [status, itemId]);
    } else {
      const item = memoryStore.order_items.find(i => i.id === itemId);
      if (item) item.status = status;
    }

    res.json({ success: true, message: 'Cập nhật trạng thái món thành công' });
  } catch (error) {
    console.error('updateKdsItemStatus error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật KDS' });
  }
}

module.exports = {
  getKdsOrders,
  updateKdsItemStatus
};
