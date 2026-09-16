const { pool, isPostgresConnected, memoryStore } = require('../config/db');

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
    transaction_code
  } = req.body;

  if (!order_id || amount === undefined) {
    return res.status(400).json({ success: false, message: 'Thiếu mã đơn hàng hoặc số tiền thanh toán' });
  }

  const payAmount = parseFloat(amount);
  const received = parseFloat(cash_received) || payAmount;
  const change = Math.max(0, received - payAmount);

  try {
    let payment = null;

    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

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
        const orderRes = await client.query(
          `UPDATE orders 
           SET payment_status = 'PAID', 
               order_status = 'COMPLETED',
               completed_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 RETURNING *`,
          [order_id]
        );
        const order = orderRes.rows[0];

        // If dine-in, free the table
        if (order && order.table_id) {
          await client.query(
            'UPDATE tables SET status = $1, current_order_id = NULL WHERE id = $2',
            ['EMPTY', order.table_id]
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
      if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

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
      order.order_status = 'COMPLETED';
      order.completed_at = new Date().toISOString();

      // Free table
      if (order.table_id) {
        const table = memoryStore.tables.find(t => t.id === order.table_id);
        if (table) {
          table.status = 'EMPTY';
          table.current_order_id = null;
        }
      }
    }

    res.json({
      success: true,
      message: 'Thanh toán thành công',
      payment,
      change
    });
  } catch (error) {
    console.error('processPayment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi xử lý thanh toán: ' + error.message });
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
