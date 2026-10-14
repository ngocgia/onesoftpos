const { pool, isPostgresConnected, memoryStore } = require('../config/db');
const { normalizeWorkflow, currentStep, resolveStageIndex, roleCanHandle, legacyStatusForStep } = require('../services/workflowService');

const TAKEAWAY_FULFILLMENT_TYPES = ['SHIP_DELIVERY', 'CUSTOMER_PICKUP', 'APP_DELIVERY'];

function validateTakeawayDetails(takeawayWorkspaceEnabled, orderType, details) {
  if (!takeawayWorkspaceEnabled || orderType !== 'TAKEAWAY') return null;
  if (!TAKEAWAY_FULFILLMENT_TYPES.includes(details.fulfillment_type)) return 'Vui lòng chọn loại đơn mang đi';
  if (!details.scheduled_at || Number.isNaN(new Date(details.scheduled_at).getTime())) return 'Vui lòng nhập giờ hẹn/giờ đến lấy hợp lệ';
  if (details.fulfillment_type === 'SHIP_DELIVERY' && (!details.customer_name || !details.customer_phone || !details.delivery_address)) {
    return 'Đơn Ship mang về cần tên khách, số điện thoại và địa chỉ';
  }
  if (details.fulfillment_type === 'CUSTOMER_PICKUP' && (!details.customer_name || !details.customer_phone)) {
    return 'Đơn Khách tới lấy cần tên khách và số điện thoại';
  }
  return null;
}

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
    fulfillment_type,
    customer_name,
    customer_phone,
    delivery_address,
    scheduled_at,
    existing_order_id,
    note,
    items = [],
    discount_amount = 0,
    tax_amount = 0
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Đơn hàng phải có ít nhất 1 sản phẩm' });
  }

  const orderCode = generateOrderCode();

  try {
    let createdOrder = null;
    let appendedToExistingOrder = false;
    let workflowDefinition;
    let takeawayWorkspaceEnabled = false;
    if (isPostgresConnected()) {
      const workflowResult = await pool.query(`SELECT ss.workflow_definition,
        COALESCE(ss.takeaway_workspace_enabled,
          EXISTS (SELECT 1 FROM store_type_features f WHERE f.store_type_id=s.store_type_id AND f.feature_code='TAKEAWAY' AND f.enabled=TRUE)
          AND NOT EXISTS (SELECT 1 FROM store_type_features f WHERE f.store_type_id=s.store_type_id AND f.feature_code='DINE_IN' AND f.enabled=TRUE)
          AND NOT EXISTS (SELECT 1 FROM store_type_features f WHERE f.store_type_id=s.store_type_id AND f.feature_code='TABLE' AND f.enabled=TRUE)
        ) AS takeaway_workspace_enabled
        FROM stores s LEFT JOIN store_settings ss ON ss.store_id=s.id
        WHERE s.id=$1`, [storeId]);
      workflowDefinition = workflowResult.rows[0]?.workflow_definition;
      takeawayWorkspaceEnabled = !!workflowResult.rows[0]?.takeaway_workspace_enabled;
      const channelResult = await pool.query("SELECT payload FROM menu_preferences WHERE owner_type='store' AND owner_id=$1 AND section='workflow'", [storeId]);
      if (channelResult.rows[0]) {
        const channels = JSON.parse(channelResult.rows[0].payload);
        if ((order_type === 'DINE_IN' && !channels.enableDineIn) || (order_type === 'TAKEAWAY' && !channels.enableTakeaway)
          || (fulfillment_type === 'SHIP_DELIVERY' && !channels.enableDelivery)) {
          return res.status(400).json({ success: false, message: 'Kênh bán này đang tắt tại cửa hàng' });
        }
        takeawayWorkspaceEnabled = channels.enableTakeaway && !channels.enableDineIn;
      }
    } else {
      const settings = memoryStore.store_settings.find(item => item.store_id === storeId);
      workflowDefinition = settings?.workflow_definition;
      const store = memoryStore.stores.find(item => item.id === storeId);
      const featureEnabled = code => memoryStore.store_type_features
        .some(item => item.store_type_id === store?.store_type_id && item.feature_code === code && item.enabled);
      takeawayWorkspaceEnabled = typeof settings?.takeaway_workspace_enabled === 'boolean'
        ? settings.takeaway_workspace_enabled
        : featureEnabled('TAKEAWAY') && !featureEnabled('DINE_IN') && !featureEnabled('TABLE');
    }

    // Only accept toppings that are active and configured for the selected product.
    const requestedOptionIds = [...new Set(items.flatMap(item => Array.isArray(item.options)
      ? item.options.map(option => Number(option.option_id)).filter(Number.isInteger)
      : []))];
    let allowedOptions = [];
    if (requestedOptionIds.length && isPostgresConnected()) {
      const result = await pool.query(`SELECT pop.product_id, po.id, po.name, po.price
        FROM product_option_products pop
        JOIN product_options po ON po.id=pop.option_id AND po.is_active=TRUE
        JOIN products p ON p.id=pop.product_id
        WHERE po.store_id=$1 AND p.store_id=$1 AND po.id=ANY($2::int[])`, [storeId, requestedOptionIds]);
      allowedOptions = result.rows;
    } else if (requestedOptionIds.length) {
      allowedOptions = memoryStore.product_option_products.flatMap(link => {
        const option = memoryStore.product_options.find(item => item.id === link.option_id && item.store_id === storeId && item.is_active);
        const product = memoryStore.products.find(item => item.id === link.product_id && item.store_id === storeId);
        return option && product ? [{ product_id: product.id, id: option.id, name: option.name, price: option.price }] : [];
      });
    }
    for (const item of items) {
      if (!Array.isArray(item.options)) continue;
      item.options = item.options.map(option => {
        const allowed = allowedOptions.find(candidate => candidate.product_id === Number(item.product_id) && candidate.id === Number(option.option_id));
        if (!allowed) { const error = new Error(`Topping không được áp dụng cho món ${item.product_name || ''}`.trim()); error.statusCode = 400; throw error; }
        return { option_id: allowed.id, option_name: allowed.name, price: Number(allowed.price) };
      });
    }

    let subtotal = 0;
    items.forEach(item => {
      const optionTotal = (item.options || []).reduce((sum, option) => sum + Number(option.price || 0), 0);
      item.calculatedSubtotal = ((parseFloat(item.unit_price) || 0) + optionTotal) * (item.quantity || 1);
      subtotal += item.calculatedSubtotal;
    });
    const totalAmount = Math.max(0, subtotal - parseFloat(discount_amount || 0) + parseFloat(tax_amount || 0));
    const parsedSchedule = scheduled_at ? new Date(scheduled_at) : null;
    const takeawayDetails = {
      fulfillment_type: String(fulfillment_type || '').trim().toUpperCase(),
      customer_name: String(customer_name || '').trim() || null,
      customer_phone: String(customer_phone || '').trim() || null,
      delivery_address: String(delivery_address || '').trim() || null,
      scheduled_at: parsedSchedule && !Number.isNaN(parsedSchedule.getTime()) ? parsedSchedule.toISOString() : scheduled_at
    };
    const fulfillmentError = validateTakeawayDetails(takeawayWorkspaceEnabled, order_type, takeawayDetails);
    if (fulfillmentError) return res.status(400).json({ success: false, message: fulfillmentError });
    if (takeawayDetails.fulfillment_type === 'CUSTOMER_PICKUP') takeawayDetails.delivery_address = null;
    if (takeawayDetails.fulfillment_type === 'APP_DELIVERY') {
      takeawayDetails.customer_name = null;
      takeawayDetails.customer_phone = null;
      takeawayDetails.delivery_address = null;
    }
    if (!takeawayWorkspaceEnabled || order_type !== 'TAKEAWAY') {
      takeawayDetails.fulfillment_type = null;
      takeawayDetails.delivery_address = null;
      takeawayDetails.scheduled_at = null;
    }
    const workflow = normalizeWorkflow(workflowDefinition);
    const createStep = workflow.steps[0];
    if (!roleCanHandle(createStep, req.user?.role)) {
      return res.status(403).json({ success: false, message: `Chỉ nhóm ${createStep.roles.join(', ')} được tạo đơn trong luồng này` });
    }
    const initialStageIndex = 1;
    const initialStep = currentStep(workflow, initialStageIndex);
    const initialStatus = legacyStatusForStep(initialStep);

    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        let existingOrder = null;
        if (order_type === 'DINE_IN' && table_id) {
          const tableRes = await client.query(
            'SELECT current_order_id FROM tables WHERE id=$1 AND store_id=$2 FOR UPDATE',
            [table_id, storeId]
          );
          if (!tableRes.rows.length) {
            const error = new Error('Không tìm thấy bàn');
            error.statusCode = 404;
            throw error;
          }
          const currentOrderId = tableRes.rows[0].current_order_id;
          if (existing_order_id && Number(existing_order_id) !== Number(currentOrderId)) {
            const error = new Error('Đơn hiện tại của bàn đã thay đổi, vui lòng tải lại bàn');
            error.statusCode = 409;
            throw error;
          }
          if (currentOrderId) {
            const existingRes = await client.query(
              `SELECT * FROM orders WHERE id=$1 AND store_id=$2 AND table_id=$3
               AND payment_status='UNPAID' AND order_status NOT IN ('COMPLETED','CANCELLED') FOR UPDATE`,
              [currentOrderId, storeId, table_id]
            );
            existingOrder = existingRes.rows[0] || null;
            if (!existingOrder) {
              const error = new Error('Đơn hiện tại của bàn không còn khả dụng');
              error.statusCode = 409;
              throw error;
            }
            appendedToExistingOrder = true;
          }
        }

        const shiftRes = await client.query(
          `SELECT id FROM shifts
           WHERE store_id = $1 AND user_id = $2 AND status = 'OPEN'
           ORDER BY id DESC LIMIT 1`,
          [storeId, cashierId]
        );
        const shiftId = shiftRes.rows[0] ? shiftRes.rows[0].id : null;

        const orderRes = existingOrder ? null : await client.query(
          `INSERT INTO orders (
            order_code, store_id, shift_id, order_type, fulfillment_type, table_id, customer_name, customer_phone,
            delivery_address, scheduled_at,
            cashier_id, subtotal, discount_amount, tax_amount, total_amount,
            payment_status, order_status, workflow_stage_index, workflow_snapshot, note
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'UNPAID',$16,$17,$18::jsonb,$19)
          RETURNING *`,
          [orderCode, storeId, shiftId, order_type, takeawayDetails.fulfillment_type, table_id || null,
            takeawayDetails.customer_name, takeawayDetails.customer_phone, takeawayDetails.delivery_address,
            takeawayDetails.scheduled_at, cashierId, subtotal, discount_amount, tax_amount, totalAmount,
            initialStatus, initialStageIndex, JSON.stringify(workflow), note]
        );
        createdOrder = existingOrder || orderRes.rows[0];

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

        if (existingOrder) {
          const nextSubtotal = Number(existingOrder.subtotal || 0) + subtotal;
          const nextDiscount = Number(existingOrder.discount_amount || 0) + Number(discount_amount || 0);
          const nextTax = Number(existingOrder.tax_amount || 0) + Number(tax_amount || 0);
          const nextTotal = Math.max(0, nextSubtotal - nextDiscount + nextTax);
          const updated = await client.query(
            `UPDATE orders SET subtotal=$1, discount_amount=$2, tax_amount=$3,
             total_amount=$7, order_status=$4, workflow_stage_index=$5,
             updated_at=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *`,
            [nextSubtotal, nextDiscount, nextTax, initialStatus, initialStageIndex, existingOrder.id, nextTotal]
          );
          createdOrder = updated.rows[0];
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
      const table = order_type === 'DINE_IN' && table_id
        ? memoryStore.tables.find(item => item.id === parseInt(table_id, 10) && item.store_id === storeId)
        : null;
      if (order_type === 'DINE_IN' && table_id && !table) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy bàn' });
      }
      if (existing_order_id && Number(existing_order_id) !== Number(table?.current_order_id)) {
        return res.status(409).json({ success: false, message: 'Đơn hiện tại của bàn đã thay đổi, vui lòng tải lại bàn' });
      }
      const existingOrder = table?.current_order_id
        ? memoryStore.orders.find(item => item.id === table.current_order_id && item.store_id === storeId && item.table_id === table.id
          && item.payment_status === 'UNPAID' && !['COMPLETED', 'CANCELLED'].includes(item.order_status))
        : null;
      if (table?.current_order_id && !existingOrder) {
        return res.status(409).json({ success: false, message: 'Đơn hiện tại của bàn không còn khả dụng' });
      }
      appendedToExistingOrder = !!existingOrder;
      const orderId = existingOrder?.id || (memoryStore.orders.length ? Math.max(...memoryStore.orders.map(o => o.id)) + 1 : 1);
      const currentShift = [...memoryStore.shifts].reverse().find(
        s => s.store_id === storeId && s.user_id === cashierId && s.status === 'OPEN'
      );
      createdOrder = existingOrder || {
        id: orderId,
        order_code: orderCode,
        store_id: storeId,
        shift_id: currentShift ? currentShift.id : null,
        order_type,
        fulfillment_type: takeawayDetails.fulfillment_type,
        table_id: table_id ? parseInt(table_id, 10) : null,
        customer_name: takeawayDetails.customer_name,
        customer_phone: takeawayDetails.customer_phone,
        delivery_address: takeawayDetails.delivery_address,
        scheduled_at: takeawayDetails.scheduled_at,
        cashier_id: cashierId,
        subtotal,
        discount_amount: parseFloat(discount_amount || 0),
        tax_amount: parseFloat(tax_amount || 0),
        total_amount: totalAmount,
        payment_status: 'UNPAID',
        order_status: initialStatus,
        workflow_stage_index: initialStageIndex,
        workflow_snapshot: workflow,
        note,
        created_at: new Date().toISOString()
      };
      if (!existingOrder) memoryStore.orders.unshift(createdOrder);

      let nextItemId = memoryStore.order_items.length
        ? Math.max(...memoryStore.order_items.map(item => item.id)) + 1
        : 1;
      let nextOptionId = memoryStore.order_item_options.length
        ? Math.max(...memoryStore.order_item_options.map(option => option.id)) + 1
        : 1;

      items.forEach(it => {
        const itemId = nextItemId++;
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
          it.options.forEach(opt => {
            memoryStore.order_item_options.push({
              id: nextOptionId++,
              order_item_id: itemId,
              option_id: opt.option_id,
              option_name: opt.option_name,
              price: opt.price || 0
            });
          });
        }
      });

      if (existingOrder) {
        existingOrder.subtotal = Number(existingOrder.subtotal || 0) + subtotal;
        existingOrder.discount_amount = Number(existingOrder.discount_amount || 0) + Number(discount_amount || 0);
        existingOrder.tax_amount = Number(existingOrder.tax_amount || 0) + Number(tax_amount || 0);
        existingOrder.total_amount = Math.max(0, existingOrder.subtotal - existingOrder.discount_amount + existingOrder.tax_amount);
        existingOrder.order_status = initialStatus;
        existingOrder.workflow_stage_index = initialStageIndex;
        existingOrder.updated_at = new Date().toISOString();
      }

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
      message: appendedToExistingOrder
        ? (initialStep ? `Đã thêm món và chuyển đơn đến bước: ${initialStep.name}` : 'Đã thêm món vào đơn hiện tại')
        : (initialStep ? `Đã chuyển đơn đến bước: ${initialStep.name}` : 'Tạo đơn hàng thành công'),
      order: createdOrder
    });
  } catch (error) {
    console.error('createOrder error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Lỗi tạo đơn hàng: ' + error.message });
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
        queryStr += ` AND o.order_status = $${params.length + 1}`;
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

    orders = orders.map(order => {
      const stageIndex = resolveStageIndex(order.workflow_snapshot, order.workflow_stage_index, order.order_status, !!order.workflow_snapshot);
      const step = currentStep(order.workflow_snapshot, stageIndex);
      return { ...order, workflow_step: step, can_advance: step?.type === 'APPROVAL' && roleCanHandle(step, req.user?.role) };
    });
    res.json({ success: true, orders });
  } catch (error) {
    console.error('getOrders error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đơn hàng' });
  }
}

async function advanceOrderWorkflow(req, res) {
  const orderId = parseInt(req.params.id, 10);
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  try {
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('SELECT * FROM orders WHERE id=$1 AND store_id=$2 FOR UPDATE', [orderId, storeId]);
        if (!result.rows.length) { const error = new Error('Không tìm thấy đơn hàng'); error.statusCode = 404; throw error; }
        const order = result.rows[0];
        const workflow = normalizeWorkflow(order.workflow_snapshot);
        const stageIndex = resolveStageIndex(workflow, order.workflow_stage_index, order.order_status, !!order.workflow_snapshot);
        const step = currentStep(workflow, stageIndex);
        if (!step || step.type !== 'APPROVAL') { const error = new Error('Đơn hàng không ở bước cần phê duyệt'); error.statusCode = 409; throw error; }
        if (!roleCanHandle(step, req.user?.role)) { const error = new Error(`Bước này chỉ dành cho nhóm ${step.roles.join(', ')}`); error.statusCode = 403; throw error; }
        const nextIndex = stageIndex + 1;
        const nextStep = currentStep(workflow, nextIndex);
        const nextStatus = legacyStatusForStep(nextStep, order.payment_status);
        await client.query(`UPDATE orders SET workflow_stage_index=$1, order_status=$2,
          confirmed_by=$3, confirmed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$4`,
          [nextIndex, nextStatus, req.user.id, orderId]);
        await client.query('COMMIT');
        return res.json({ success: true, message: nextStep ? `Đã chuyển đến bước: ${nextStep.name}` : 'Đã hoàn tất quy trình', workflow_step: nextStep });
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }

    const order = memoryStore.orders.find(item => item.id === orderId && item.store_id === storeId);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    const workflow = normalizeWorkflow(order.workflow_snapshot);
    const stageIndex = resolveStageIndex(workflow, order.workflow_stage_index, order.order_status, !!order.workflow_snapshot);
    const step = currentStep(workflow, stageIndex);
    if (!step || step.type !== 'APPROVAL') return res.status(409).json({ success: false, message: 'Đơn hàng không ở bước cần phê duyệt' });
    if (!roleCanHandle(step, req.user?.role)) return res.status(403).json({ success: false, message: `Bước này chỉ dành cho nhóm ${step.roles.join(', ')}` });
    order.workflow_stage_index = stageIndex + 1;
    const nextStep = currentStep(workflow, order.workflow_stage_index);
    order.order_status = legacyStatusForStep(nextStep, order.payment_status);
    order.confirmed_by = req.user.id;
    order.confirmed_at = new Date().toISOString();
    return res.json({ success: true, message: nextStep ? `Đã chuyển đến bước: ${nextStep.name}` : 'Đã hoàn tất quy trình', workflow_step: nextStep });
  } catch (error) {
    console.error('advanceOrderWorkflow error:', error);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Không thể chuyển bước quy trình' });
  }
}

async function getOrderById(req, res) {
  const orderId = parseInt(req.params.id, 10);
  const storeId = req.storeId || parseInt(req.query.store_id, 10);

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
         WHERE o.id = $1 AND o.store_id = $2`,
        [orderId, storeId]
      );
      if (orderRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      }
      order = orderRes.rows[0];

      const itemRes = await pool.query(`
        SELECT oi.*, prepared_user.full_name AS prepared_by_name,
               cancelled_user.full_name AS cancelled_by_name
        FROM order_items oi
        LEFT JOIN users prepared_user ON prepared_user.id = oi.prepared_by
        LEFT JOIN users cancelled_user ON cancelled_user.id = oi.cancelled_by
        WHERE oi.order_id = $1 ORDER BY oi.id ASC
      `, [orderId]);
      items = itemRes.rows;

      for (let item of items) {
        const optRes = await pool.query('SELECT * FROM order_item_options WHERE order_item_id = $1', [item.id]);
        item.options = optRes.rows;
      }

      const payRes = await pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);
      payments = payRes.rows;
    } else {
      order = memoryStore.orders.find(o => o.id === orderId && o.store_id === storeId);
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
        const preparedUser = memoryStore.users.find(user => user.id === i.prepared_by);
        const cancelledUser = memoryStore.users.find(user => user.id === i.cancelled_by);
        return {
          ...i,
          prepared_by_name: preparedUser?.full_name || null,
          cancelled_by_name: cancelledUser?.full_name || null,
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
  const storeId = req.storeId || parseInt(req.body.store_id, 10);

  if (status !== 'CANCELLED') return res.status(409).json({ success: false, message: 'Hãy dùng thao tác hoàn tất bước của quy trình' });

  try {
    if (isPostgresConnected()) {
      const current = await pool.query('SELECT * FROM orders WHERE id = $1 AND store_id = $2', [orderId, storeId]);
      if (!current.rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      const order = current.rows[0];
      if (order.order_status === 'PENDING_CONFIRMATION' && status === 'CONFIRMED') {
        if (!['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'CASHIER'].includes(req.user.role)) {
          return res.status(403).json({ success: false, message: 'Chỉ thu ngân hoặc quản lý được xác nhận đơn' });
        }
        await pool.query(`UPDATE orders SET order_status='CONFIRMED', confirmed_by=$1, confirmed_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [req.user.id, orderId]);
      } else {
        await pool.query('UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, orderId]);
      }
    } else {
      const order = memoryStore.orders.find(o => o.id === orderId && o.store_id === storeId);
      if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
      if (order.order_status === 'PENDING_CONFIRMATION' && status === 'CONFIRMED') {
        if (!['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER', 'CASHIER'].includes(req.user.role)) {
          return res.status(403).json({ success: false, message: 'Chỉ thu ngân hoặc quản lý được xác nhận đơn' });
        }
        order.confirmed_by = req.user.id;
        order.confirmed_at = new Date().toISOString();
      }
      order.order_status = status;
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
            order_code, store_id, order_type, fulfillment_type, table_id, customer_name, customer_phone,
            delivery_address, scheduled_at,
            cashier_id, subtotal, total_amount, payment_status, order_status,
            workflow_stage_index, workflow_snapshot, note
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,0,'UNPAID',$11,$12,$13,$14)
          RETURNING *`,
          [newOrderCode, original.store_id, original.order_type, original.fulfillment_type, original.table_id,
            original.customer_name, original.customer_phone, original.delivery_address, original.scheduled_at,
            original.cashier_id, original.order_status, original.workflow_stage_index, original.workflow_snapshot,
            'Tách từ đơn ' + original.order_code]
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
  advanceOrderWorkflow,
  updateOrderStatus,
  splitOrder
};
