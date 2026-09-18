const { pool, isPostgresConnected, memoryStore } = require('../config/db');

async function getCurrentShift(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const userId = req.user ? req.user.id : null;

  try {
    let shift = null;
    if (isPostgresConnected()) {
      const resQuery = await pool.query(
        'SELECT * FROM shifts WHERE store_id = $1 AND user_id = $2 AND status = $3 ORDER BY id DESC LIMIT 1',
        [storeId, userId, 'OPEN']
      );
      shift = resQuery.rows[0] || null;
    } else {
      shift = memoryStore.shifts.find(s => s.store_id === storeId && s.user_id === userId && s.status === 'OPEN') || null;
    }

    res.json({ success: true, shift });
  } catch (error) {
    console.error('getCurrentShift error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy thông tin ca làm việc' });
  }
}

async function openShift(req, res) {
  const storeId = req.storeId || parseInt(req.body.store_id, 10);
  const userId = req.user ? req.user.id : null;
  const { opening_cash = 0, notes } = req.body;

  try {
    let newShift = null;
    if (isPostgresConnected()) {
      const resQuery = await pool.query(
        `INSERT INTO shifts (store_id, user_id, opening_cash, expected_cash, status, notes)
         VALUES ($1, $2, $3, $3, 'OPEN', $4) RETURNING *`,
        [storeId, userId, parseFloat(opening_cash), notes || '']
      );
      newShift = resQuery.rows[0];
    } else {
      newShift = {
        id: memoryStore.shifts.length + 1,
        store_id: storeId,
        user_id: userId,
        opening_time: new Date().toISOString(),
        opening_cash: parseFloat(opening_cash),
        expected_cash: parseFloat(opening_cash),
        closing_cash: 0,
        difference: 0,
        status: 'OPEN',
        notes: notes || ''
      };
      memoryStore.shifts.push(newShift);
    }

    res.status(201).json({ success: true, message: 'Mở ca làm việc thành công', shift: newShift });
  } catch (error) {
    console.error('openShift error:', error);
    res.status(500).json({ success: false, message: 'Lỗi mở ca' });
  }
}

async function closeShift(req, res) {
  const shiftId = parseInt(req.params.id, 10);
  const { closing_cash = 0, notes } = req.body;

  try {
    let shift = null;
    if (isPostgresConnected()) {
      // Calculate total cash collected
      const cashRes = await pool.query(
        `SELECT COALESCE(SUM(p.amount), 0) as cash_total
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         WHERE o.shift_id = $1 AND p.payment_method = 'CASH' AND p.status = 'SUCCESS'`,
        [shiftId]
      );
      const cashTotal = parseFloat(cashRes.rows[0].cash_total);

      const shiftRes = await pool.query('SELECT * FROM shifts WHERE id = $1', [shiftId]);
      const currentShift = shiftRes.rows[0];
      const expectedCash = parseFloat(currentShift.opening_cash) + cashTotal;
      const actualCash = parseFloat(closing_cash);
      const difference = actualCash - expectedCash;

      const updateRes = await pool.query(
        `UPDATE shifts 
         SET closing_cash = $1, 
             expected_cash = $2, 
             difference = $3, 
             status = 'CLOSED', 
             closing_time = CURRENT_TIMESTAMP,
             notes = COALESCE($4, notes)
         WHERE id = $5 RETURNING *`,
        [actualCash, expectedCash, difference, notes, shiftId]
      );
      shift = updateRes.rows[0];
    } else {
      shift = memoryStore.shifts.find(s => s.id === shiftId);
      if (!shift) return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm việc' });

      const actualCash = parseFloat(closing_cash);
      const cashTotal = memoryStore.payments
        .filter(payment => payment.payment_method === 'CASH' && payment.status === 'SUCCESS')
        .filter(payment => {
          const order = memoryStore.orders.find(o => o.id === payment.order_id);
          return order && order.shift_id === shiftId;
        })
        .reduce((total, payment) => total + Number(payment.amount || 0), 0);
      const expectedCash = parseFloat(shift.opening_cash) + cashTotal;
      shift.closing_cash = actualCash;
      shift.actual_cash = actualCash;
      shift.expected_cash = expectedCash;
      shift.difference = actualCash - expectedCash;
      shift.status = 'CLOSED';
      shift.closing_time = new Date().toISOString();
    }

    res.json({ success: true, message: 'Kết ca làm việc thành công', shift });
  } catch (error) {
    console.error('closeShift error:', error);
    res.status(500).json({ success: false, message: 'Lỗi kết ca' });
  }
}

module.exports = {
  getCurrentShift,
  openShift,
  closeShift
};
