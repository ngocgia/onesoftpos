const { pool, isPostgresConnected, memoryStore } = require('../config/db');
const { normalizeWorkflow, currentStep, resolveStageIndex, legacyStatusForStep } = require('../services/workflowService');

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

  if (!['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái món không hợp lệ' });
  }

  try {
    if (isPostgresConnected()) {
      const updated = await pool.query('UPDATE order_items SET status = $1 WHERE id = $2 RETURNING order_id', [status, itemId]);
      if (!updated.rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy món' });
      const orderId = updated.rows[0].order_id;
      const itemStates = await pool.query(`SELECT oi.status, o.workflow_stage_index, o.workflow_snapshot, o.payment_status
        FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.order_id = $1`, [orderId]);
      const statuses = itemStates.rows.map(item => item.status);
      let orderStatus = null;
      let nextStageIndex = resolveStageIndex(itemStates.rows[0]?.workflow_snapshot, itemStates.rows[0]?.workflow_stage_index, 'CONFIRMED', !!itemStates.rows[0]?.workflow_snapshot);
      if (statuses.every(itemStatus => itemStatus === 'SERVED' || itemStatus === 'CANCELLED')) orderStatus = 'COMPLETED';
      else if (statuses.every(itemStatus => ['READY', 'SERVED', 'CANCELLED'].includes(itemStatus))) {
        const workflow = normalizeWorkflow(itemStates.rows[0]?.workflow_snapshot);
        if (currentStep(workflow, nextStageIndex)?.type === 'KITCHEN') nextStageIndex += 1;
        orderStatus = legacyStatusForStep(currentStep(workflow, nextStageIndex), itemStates.rows[0]?.payment_status);
      }
      else if (statuses.some(itemStatus => itemStatus === 'PREPARING')) orderStatus = 'PREPARING';
      if (orderStatus) {
        const orderResult = await pool.query(`UPDATE orders SET order_status=$1, workflow_stage_index=$2,
          completed_at=CASE WHEN $1='COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING table_id`, [orderStatus, nextStageIndex, orderId]);
        if (orderStatus === 'COMPLETED' && orderResult.rows[0]?.table_id) {
          await pool.query('UPDATE tables SET status=$1, current_order_id=NULL WHERE id=$2', ['EMPTY', orderResult.rows[0].table_id]);
        }
      }
    } else {
      const item = memoryStore.order_items.find(i => i.id === itemId);
      if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy món' });
      item.status = status;
      const orderItems = memoryStore.order_items.filter(orderItem => orderItem.order_id === item.order_id);
      const statuses = orderItems.map(orderItem => orderItem.status);
      const order = memoryStore.orders.find(current => current.id === item.order_id);
      if (order) {
        if (statuses.every(itemStatus => itemStatus === 'SERVED' || itemStatus === 'CANCELLED')) {
          order.order_status = 'COMPLETED';
          order.completed_at = new Date().toISOString();
          if (order.table_id) {
            const table = memoryStore.tables.find(current => current.id === order.table_id);
            if (table) { table.status = 'EMPTY'; table.current_order_id = null; }
          }
        } else if (statuses.every(itemStatus => ['READY', 'SERVED', 'CANCELLED'].includes(itemStatus))) {
          const workflow = normalizeWorkflow(order.workflow_snapshot);
          order.workflow_stage_index = resolveStageIndex(workflow, order.workflow_stage_index, order.order_status, !!order.workflow_snapshot);
          if (currentStep(workflow, order.workflow_stage_index)?.type === 'KITCHEN') order.workflow_stage_index += 1;
          order.order_status = legacyStatusForStep(currentStep(workflow, order.workflow_stage_index), order.payment_status);
        } else if (statuses.some(itemStatus => itemStatus === 'PREPARING')) {
          order.order_status = 'PREPARING';
        }
      }
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
