const { pool, isPostgresConnected, memoryStore } = require('../config/db');
const { normalizeWorkflow, currentStep, resolveStageIndex, legacyStatusForStep } = require('../services/workflowService');

const DEFAULT_KDS_COMPLETION_MESSAGE = 'Món ăn {mon}, bàn {ban} đã xong';

function renderCompletionAnnouncement(template, item, order, table) {
  let message = String(template || DEFAULT_KDS_COMPLETION_MESSAGE).trim();
  const tableLabel = table?.code || table?.name;
  const isTakeaway = order.order_type === 'TAKEAWAY';
  const customerLabel = String(order.customer_name || '').trim();
  if (isTakeaway) {
    message = message.replace(
      /bàn\s*\{ban\}/giu,
      customerLabel ? `khách hàng ${customerLabel}` : `đơn ${order.order_code}`
    );
  } else if (!tableLabel) {
    message = message.replace(/bàn\s*\{ban\}/giu, `đơn ${order.order_code}`);
  }
  const values = {
    '{mon}': item.product_name || 'món ăn',
    '{ban}': isTakeaway ? (customerLabel || order.order_code || 'mang về') : (tableLabel || order.order_code || ''),
    '{ma_don}': order.order_code || '',
    '{ten_khach_hang}': customerLabel || order.order_code || 'khách mang về'
  };
  Object.entries(values).forEach(([token, value]) => {
    message = message.split(token).join(String(value));
  });
  return message.replace(/\s+/g, ' ').trim();
}

async function getKdsOrders(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const kitchenType = req.query.kitchen_type; // 'KITCHEN', 'BAR', or null

  try {
    let activeOrders = [];

    if (isPostgresConnected()) {
      let queryStr = `
        SELECT o.id, o.order_code, o.order_type, o.fulfillment_type, o.created_at, o.note as order_note,
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

async function getKdsHistory(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const userId = req.user?.id;

  try {
    let items;
    if (isPostgresConnected()) {
      const result = await pool.query(`
        SELECT oi.id, oi.product_name, oi.variant_name, oi.quantity, oi.note,
               oi.kitchen_type, oi.status, oi.prepared_at,
               o.id AS order_id, o.order_code, o.order_type, o.fulfillment_type,
               o.customer_name, t.code AS table_code, t.name AS table_name
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN tables t ON t.id = o.table_id
        WHERE o.store_id = $1 AND oi.prepared_by = $2 AND oi.prepared_at IS NOT NULL
        ORDER BY oi.prepared_at DESC
        LIMIT 100
      `, [storeId, userId]);
      items = result.rows;
    } else {
      items = memoryStore.order_items
        .filter(item => item.prepared_by === userId && item.prepared_at)
        .map(item => {
          const order = memoryStore.orders.find(current => current.id === item.order_id);
          if (!order || order.store_id !== storeId) return null;
          const table = memoryStore.tables.find(current => current.id === order.table_id);
          return {
            ...item,
            order_id: order.id,
            order_code: order.order_code,
            order_type: order.order_type,
            fulfillment_type: order.fulfillment_type,
            customer_name: order.customer_name,
            table_code: table?.code || null,
            table_name: table?.name || null
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.prepared_at) - new Date(a.prepared_at))
        .slice(0, 100);
    }

    return res.json({ success: true, items });
  } catch (error) {
    console.error('getKdsHistory error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy lịch sử món đã làm' });
  }
}

async function getCompletedItems(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);

  try {
    let items = [];
    if (isPostgresConnected()) {
      const result = await pool.query(`
        SELECT oi.id, oi.product_name, oi.variant_name, oi.quantity, oi.note,
               oi.kitchen_type, oi.status, oi.prepared_at,
               o.id AS order_id, o.order_code, o.order_type, o.fulfillment_type,
               o.customer_name, o.payment_status, o.created_at AS order_created_at,
               t.code AS table_code, t.name AS table_name
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN tables t ON t.id = o.table_id
        WHERE o.store_id = $1
          AND oi.status IN ('READY', 'SERVED')
          AND o.payment_status IS DISTINCT FROM 'PAID'
          AND o.order_status <> 'CANCELLED'
        ORDER BY oi.prepared_at DESC NULLS LAST, oi.id DESC
      `, [storeId]);
      items = result.rows;

      if (items.length) {
        const optionResult = await pool.query(`
          SELECT order_item_id, option_name, price
          FROM order_item_options
          WHERE order_item_id = ANY($1::int[])
          ORDER BY id ASC
        `, [items.map(item => item.id)]);
        const optionsByItem = optionResult.rows.reduce((groups, option) => {
          if (!groups[option.order_item_id]) groups[option.order_item_id] = [];
          groups[option.order_item_id].push(option);
          return groups;
        }, {});
        items.forEach(item => { item.options = optionsByItem[item.id] || []; });
      }
    } else {
      items = memoryStore.order_items
        .filter(item => ['READY', 'SERVED'].includes(item.status))
        .map(item => {
          const order = memoryStore.orders.find(current => current.id === item.order_id);
          if (!order || order.store_id !== storeId || order.payment_status === 'PAID' || order.order_status === 'CANCELLED') {
            return null;
          }
          const table = memoryStore.tables.find(current => current.id === order.table_id);
          return {
            ...item,
            order_id: order.id,
            order_code: order.order_code,
            order_type: order.order_type,
            fulfillment_type: order.fulfillment_type,
            customer_name: order.customer_name,
            payment_status: order.payment_status,
            order_created_at: order.created_at,
            table_code: table?.code || null,
            table_name: table?.name || null,
            options: memoryStore.order_item_options.filter(option => option.order_item_id === item.id)
          };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.prepared_at) - new Date(a.prepared_at));
    }

    const ordersById = new Map();
    items.forEach(item => {
      if (!ordersById.has(item.order_id)) {
        ordersById.set(item.order_id, {
          id: item.order_id,
          order_code: item.order_code,
          order_type: item.order_type,
          fulfillment_type: item.fulfillment_type,
          customer_name: item.customer_name,
          payment_status: item.payment_status,
          created_at: item.order_created_at,
          table_code: item.table_code,
          table_name: item.table_name,
          latest_prepared_at: item.prepared_at,
          items: []
        });
      }
      ordersById.get(item.order_id).items.push({
        id: item.id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        quantity: item.quantity,
        note: item.note,
        kitchen_type: item.kitchen_type,
        status: item.status,
        prepared_at: item.prepared_at,
        options: item.options || []
      });
    });

    return res.json({ success: true, orders: Array.from(ordersById.values()) });
  } catch (error) {
    console.error('getCompletedItems error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách món đã hoàn thành' });
  }
}

async function updateKdsItemStatus(req, res) {
  const itemId = parseInt(req.params.itemId, 10);
  const { status } = req.body; // PENDING, PREPARING, READY, SERVED
  const storeId = req.storeId || parseInt(req.body.store_id, 10);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã món không hợp lệ' });
  }
  if (!['PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái món không hợp lệ' });
  }

  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const itemResult = await client.query(`
          SELECT oi.id, oi.order_id, oi.product_name, oi.status AS item_status,
                 o.order_code, o.order_type, o.customer_name, o.order_status, o.payment_status,
                 o.workflow_stage_index, o.workflow_snapshot,
                 t.code AS table_code, t.name AS table_name,
                 ss.kds_completion_message
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          LEFT JOIN tables t ON t.id = o.table_id
          LEFT JOIN store_settings ss ON ss.store_id = o.store_id
          WHERE oi.id = $1 AND o.store_id = $2
          FOR UPDATE OF oi, o
        `, [itemId, storeId]);

        if (!itemResult.rows.length) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, message: 'Không tìm thấy món trong cửa hàng này' });
        }

        const item = itemResult.rows[0];
        if (['COMPLETED', 'CANCELLED'].includes(item.order_status)) {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, message: 'Đơn hàng đã kết thúc, không thể cập nhật KDS' });
        }

        const allowedTransitions = {
          PENDING: ['PREPARING', 'CANCELLED'],
          PREPARING: ['READY', 'CANCELLED'],
          READY: ['SERVED', 'CANCELLED'],
          SERVED: [],
          CANCELLED: []
        };
        if (status !== item.item_status && !allowedTransitions[item.item_status]?.includes(status)) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            success: false,
            message: `Không thể chuyển món từ ${item.item_status} sang ${status}`
          });
        }

        await client.query(`
          UPDATE order_items
          SET status = $1::varchar,
              prepared_by = CASE WHEN $1::varchar = 'READY' AND status <> 'READY' THEN $3::int ELSE prepared_by END,
              prepared_at = CASE WHEN $1::varchar = 'READY' AND status <> 'READY' THEN CURRENT_TIMESTAMP ELSE prepared_at END
          WHERE id = $2
        `, [status, itemId, req.user.id]);
        const stateResult = await client.query('SELECT status FROM order_items WHERE order_id = $1', [item.order_id]);
        const statuses = stateResult.rows.map(row => row.status);
        const workflow = normalizeWorkflow(item.workflow_snapshot);
        let stageIndex = resolveStageIndex(
          workflow,
          item.workflow_stage_index,
          item.order_status,
          !!item.workflow_snapshot
        );
        let orderStatus = item.order_status;

        if (statuses.length && statuses.every(itemStatus => itemStatus === 'CANCELLED')) {
          orderStatus = 'CANCELLED';
          stageIndex = workflow.steps.length;
        } else if (statuses.length && statuses.every(itemStatus => ['READY', 'SERVED', 'CANCELLED'].includes(itemStatus))) {
          if (currentStep(workflow, stageIndex)?.type === 'KITCHEN') stageIndex += 1;
          // KDS only finishes preparation. Payment is the only action that completes an order.
          orderStatus = legacyStatusForStep(currentStep(workflow, stageIndex), item.payment_status);
          if (orderStatus === 'COMPLETED' && item.payment_status !== 'PAID') orderStatus = 'READY';
        } else if (statuses.some(itemStatus => itemStatus === 'PREPARING')) {
          orderStatus = 'PREPARING';
        } else if (statuses.some(itemStatus => itemStatus === 'PENDING')) {
          orderStatus = 'CONFIRMED';
        }

        const orderResult = await client.query(`
          UPDATE orders
          SET order_status = $1::varchar, workflow_stage_index = $2,
              completed_at = CASE WHEN $1::varchar = 'COMPLETED' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING id, table_id, order_status, payment_status, workflow_stage_index
        `, [orderStatus, stageIndex, item.order_id]);

        if (orderStatus === 'COMPLETED' && orderResult.rows[0]?.table_id) {
          await client.query(
            'UPDATE tables SET status = $1, current_order_id = NULL WHERE id = $2',
            ['EMPTY', orderResult.rows[0].table_id]
          );
        }

        await client.query('COMMIT');
        const announcement = status === 'READY' && item.item_status !== 'READY'
          ? renderCompletionAnnouncement(
            item.kds_completion_message,
            item,
            item,
            { code: item.table_code, name: item.table_name }
          )
          : null;
        return res.json({
          success: true,
          message: 'Cập nhật trạng thái món thành công',
          item: { id: itemId, status },
          order: orderResult.rows[0],
          announcement
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      const item = memoryStore.order_items.find(i => i.id === itemId);
      const order = item && memoryStore.orders.find(current => current.id === item.order_id && current.store_id === storeId);
      if (!item || !order) return res.status(404).json({ success: false, message: 'Không tìm thấy món trong cửa hàng này' });
      if (['COMPLETED', 'CANCELLED'].includes(order.order_status)) {
        return res.status(409).json({ success: false, message: 'Đơn hàng đã kết thúc, không thể cập nhật KDS' });
      }
      const allowedTransitions = {
        PENDING: ['PREPARING', 'CANCELLED'], PREPARING: ['READY', 'CANCELLED'],
        READY: ['SERVED', 'CANCELLED'], SERVED: [], CANCELLED: []
      };
      if (status !== item.status && !allowedTransitions[item.status]?.includes(status)) {
        return res.status(409).json({ success: false, message: `Không thể chuyển món từ ${item.status} sang ${status}` });
      }
      const previousStatus = item.status;
      item.status = status;
      if (status === 'READY' && previousStatus !== 'READY') {
        item.prepared_by = req.user.id;
        item.prepared_at = new Date().toISOString();
      }
      const orderItems = memoryStore.order_items.filter(orderItem => orderItem.order_id === item.order_id);
      const statuses = orderItems.map(orderItem => orderItem.status);
      const workflow = normalizeWorkflow(order.workflow_snapshot);
      order.workflow_stage_index = resolveStageIndex(workflow, order.workflow_stage_index, order.order_status, !!order.workflow_snapshot);
      if (statuses.length && statuses.every(itemStatus => itemStatus === 'CANCELLED')) {
        order.order_status = 'CANCELLED';
        order.workflow_stage_index = workflow.steps.length;
      } else if (statuses.length && statuses.every(itemStatus => ['READY', 'SERVED', 'CANCELLED'].includes(itemStatus))) {
        if (currentStep(workflow, order.workflow_stage_index)?.type === 'KITCHEN') order.workflow_stage_index += 1;
        order.order_status = legacyStatusForStep(currentStep(workflow, order.workflow_stage_index), order.payment_status);
        if (order.order_status === 'COMPLETED' && order.payment_status !== 'PAID') order.order_status = 'READY';
        if (order.order_status === 'COMPLETED') {
          order.completed_at = order.completed_at || new Date().toISOString();
          const table = memoryStore.tables.find(current => current.id === order.table_id);
          if (table) { table.status = 'EMPTY'; table.current_order_id = null; }
        }
      } else if (statuses.some(itemStatus => itemStatus === 'PREPARING')) {
        order.order_status = 'PREPARING';
      } else if (statuses.some(itemStatus => itemStatus === 'PENDING')) {
        order.order_status = 'CONFIRMED';
      }

      const table = memoryStore.tables.find(current => current.id === order.table_id);
      const settings = memoryStore.store_settings.find(current => current.store_id === order.store_id);
      const announcement = status === 'READY' && previousStatus !== 'READY'
        ? renderCompletionAnnouncement(settings?.kds_completion_message, item, order, table)
        : null;
      return res.json({
        success: true,
        message: 'Cập nhật trạng thái món thành công',
        item: { id: itemId, status },
        order: {
          id: order.id,
          order_status: order.order_status,
          payment_status: order.payment_status,
          workflow_stage_index: order.workflow_stage_index
        },
        announcement
      });
    }
  } catch (error) {
    console.error('updateKdsItemStatus error:', error);
    res.status(500).json({ success: false, message: 'Lỗi cập nhật KDS' });
  }
}

module.exports = {
  getKdsOrders,
  getKdsHistory,
  getCompletedItems,
  updateKdsItemStatus
};
