const { pool, isPostgresConnected, memoryStore } = require('../config/db');
const { normalizeWorkflow, currentStep, resolveStageIndex, roleCanHandle } = require('../services/workflowService');

// VietQR Bank BIN Map
const BANK_BIN_MAP = {
  'MB Bank': '970422',
  'MBBank': '970422',
  'Vietcombank': '970436',
  'Techcombank': '970407',
  'VPBank': '970432',
  'ACB': '970416',
  'BIDV': '970418',
  'VietinBank': '970415',
  'TPBank': '970423'
};

async function processPayment(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const {
    order_id,
    payment_method = 'CASH', // CASH, BANK_TRANSFER, QR, CARD
    amount,
    cash_received = 0,
    transaction_code,
    replace_existing = false
  } = req.body;

  if (!order_id || amount === undefined) {
    return res.status(400).json({ success: false, message: 'Thiếu mã đơn hàng hoặc số tiền thanh toán' });
  }

  const payAmount = parseFloat(amount);
  const parsedReceived = parseFloat(cash_received);
  const received = Number.isFinite(parsedReceived) ? parsedReceived : payAmount;
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Số tiền thanh toán không hợp lệ' });
  }
  if (payment_method === 'CASH' && received < payAmount) {
    return res.status(400).json({ success: false, message: 'Tiền khách đưa chưa đủ để thanh toán' });
  }
  const change = Math.max(0, received - payAmount);

  try {
    let payment = null;
    let updatedOrder = null;

    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const orderCheck = await client.query(
          'SELECT * FROM orders WHERE id = $1 AND store_id = $2 FOR UPDATE',
          [order_id, storeId]
        );
        if (orderCheck.rows.length === 0) {
          const error = new Error('Không tìm thấy đơn hàng trong cửa hàng hiện tại');
          error.statusCode = 404;
          throw error;
        }
        const currentOrder = orderCheck.rows[0];
        const isRepayment = currentOrder.payment_status === 'PAID' && replace_existing === true;
        if (currentOrder.payment_status === 'PAID' && !isRepayment) {
          const error = new Error('Đơn hàng đã được thanh toán');
          error.statusCode = 409;
          throw error;
        }
        if (currentOrder.order_status === 'CANCELLED') {
          const error = new Error('Không thể thanh toán đơn hàng đã hủy');
          error.statusCode = 409;
          throw error;
        }
        const workflow = normalizeWorkflow(currentOrder.workflow_snapshot);
        const stageIndex = resolveStageIndex(workflow, currentOrder.workflow_stage_index, currentOrder.order_status, !!currentOrder.workflow_snapshot);
        const paymentStep = isRepayment
          ? [...workflow.steps].reverse().find(step => step.type === 'PAYMENT')
          : currentStep(workflow, stageIndex);
        if (!paymentStep || paymentStep.type !== 'PAYMENT') {
          const error = new Error('Đơn hàng chưa đến bước thanh toán trong quy trình');
          error.statusCode = 409;
          throw error;
        }
        if (!roleCanHandle(paymentStep, req.user?.role)) {
          const error = new Error(`Bước thanh toán chỉ dành cho nhóm ${paymentStep.roles.join(', ')}`);
          error.statusCode = 403;
          throw error;
        }
        if (Math.abs(Number(currentOrder.total_amount) - payAmount) > 0.001) {
          const error = new Error('Số tiền thanh toán không khớp tổng tiền đơn hàng');
          error.statusCode = 400;
          throw error;
        }

        // Keep the previous transaction for audit, but exclude it from revenue and shift totals.
        if (isRepayment) {
          await client.query(
            `UPDATE payments SET status = 'REPLACED'
             WHERE order_id = $1 AND store_id = $2 AND status = 'SUCCESS'`,
            [order_id, storeId]
          );
        }

        // Insert payment record
        const payRes = await client.query(
          `INSERT INTO payments (
            order_id, store_id, payment_method, amount, cash_received, cash_return,
            transaction_code, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUCCESS') RETURNING *`,
          [order_id, storeId, payment_method, payAmount, received, change, transaction_code || null]
        );
        payment = payRes.rows[0];

        // Update order status
        const nextStageIndex = workflow.steps.length;
        const orderRes = await client.query(
          `UPDATE orders 
           SET payment_status = 'PAID', workflow_stage_index=$2, order_status='COMPLETED',
               completed_at=CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`,
          [order_id, nextStageIndex]
        );
        updatedOrder = orderRes.rows[0];

        if (currentOrder.table_id) {
          await client.query(
            `UPDATE tables SET status='EMPTY', current_order_id=NULL
             WHERE id=$1 AND current_order_id=$2`,
            [currentOrder.table_id, currentOrder.id]
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
      const order = memoryStore.orders.find(o => o.id === parseInt(order_id, 10));
      if (!order || order.store_id !== storeId) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng trong cửa hàng hiện tại' });
      }
      const isRepayment = order.payment_status === 'PAID' && replace_existing === true;
      if (order.payment_status === 'PAID' && !isRepayment) {
        return res.status(409).json({ success: false, message: 'Đơn hàng đã được thanh toán' });
      }
      if (order.order_status === 'CANCELLED') {
        return res.status(409).json({ success: false, message: 'Không thể thanh toán đơn hàng đã hủy' });
      }
      const workflow = normalizeWorkflow(order.workflow_snapshot);
      const stageIndex = resolveStageIndex(workflow, order.workflow_stage_index, order.order_status, !!order.workflow_snapshot);
      const paymentStep = isRepayment
        ? [...workflow.steps].reverse().find(step => step.type === 'PAYMENT')
        : currentStep(workflow, stageIndex);
      if (!paymentStep || paymentStep.type !== 'PAYMENT') return res.status(409).json({ success: false, message: 'Đơn hàng chưa đến bước thanh toán trong quy trình' });
      if (!roleCanHandle(paymentStep, req.user?.role)) return res.status(403).json({ success: false, message: `Bước thanh toán chỉ dành cho nhóm ${paymentStep.roles.join(', ')}` });
      if (Math.abs(Number(order.total_amount) - payAmount) > 0.001) {
        return res.status(400).json({ success: false, message: 'Số tiền thanh toán không khớp tổng tiền đơn hàng' });
      }

      if (isRepayment) {
        memoryStore.payments
          .filter(item => item.order_id === parseInt(order_id, 10) && item.store_id === storeId && item.status === 'SUCCESS')
          .forEach(item => { item.status = 'REPLACED'; });
      }

      payment = {
        id: memoryStore.payments.length + 1,
        order_id: parseInt(order_id, 10),
        store_id: storeId,
        payment_method,
        amount: payAmount,
        cash_received: received,
        cash_return: change,
        transaction_code,
        status: 'SUCCESS',
        created_at: new Date().toISOString()
      };
      memoryStore.payments.push(payment);

      order.payment_status = 'PAID';
      order.workflow_stage_index = workflow.steps.length;
      order.order_status = 'COMPLETED';
      order.completed_at = new Date().toISOString();
      order.updated_at = order.completed_at;
      updatedOrder = order;

      if (order.table_id) {
        const table = memoryStore.tables.find(item => item.id === order.table_id && item.current_order_id === order.id);
        if (table) {
          table.status = 'EMPTY';
          table.current_order_id = null;
        }
      }
    }

    res.json({
      success: true,
      message: replace_existing === true ? 'Thanh toán lại thành công' : 'Thanh toán thành công',
      payment,
      order: updatedOrder,
      change
    });
  } catch (error) {
    console.error('processPayment error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: 'Lỗi xử lý thanh toán: ' + error.message });
  }
}

// Rule 28: Tạo mã VietQR động theo đơn hàng
async function getVietQR(req, res) {
  const orderId = parseInt(req.params.orderId, 10);
  const storeId = req.storeId || parseInt(req.query.store_id, 10);

  try {
    let order = null;
    let settings = null;

    if (isPostgresConnected()) {
      const oRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      order = oRes.rows[0];

      const sRes = await pool.query('SELECT * FROM store_settings WHERE store_id = $1', [storeId || (order && order.store_id)]);
      settings = sRes.rows[0];
    } else {
      order = memoryStore.orders.find(o => o.id === orderId);
      settings = memoryStore.store_settings.find(s => s.store_id === (storeId || (order && order.store_id)));
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    const bankName = (settings && settings.bank_name) || 'MB Bank';
    const bankAccount = (settings && settings.bank_account_number) || '090123456789';
    const accountHolder = (settings && settings.bank_account_holder) || 'THICH GA POS';
    const amount = parseInt(order.total_amount, 10);
    const memo = `${order.order_code}`;

    const bin = BANK_BIN_MAP[bankName] || '970422'; // Default MBBank
    const encodedHolder = encodeURIComponent(accountHolder);
    const encodedMemo = encodeURIComponent(memo);

    // Standard VietQR QuickLink format
    const qrUrl = `https://img.vietqr.io/image/${bin}-${bankAccount}-compact2.png?amount=${amount}&addInfo=${encodedMemo}&accountName=${encodedHolder}`;

    res.json({
      success: true,
      qrUrl,
      bankName,
      bankAccount,
      accountHolder,
      amount,
      memo
    });
  } catch (error) {
    console.error('getVietQR error:', error);
    res.status(500).json({ success: false, message: 'Lỗi tạo mã QR ngân hàng' });
  }
}

module.exports = {
  processPayment,
  getVietQR
};
