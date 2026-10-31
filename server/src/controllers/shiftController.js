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
  const { notes } = req.body;
  const parsedOpeningCash = parseFloat(req.body.opening_cash === undefined ? 0 : req.body.opening_cash);

  // Opening cash must be a non-negative number.
  if (!Number.isFinite(parsedOpeningCash) || parsedOpeningCash < 0) {
    return res.status(400).json({ success: false, message: 'Tiền đầu ca không hợp lệ' });
  }

  try {
    let newShift = null;
    if (isPostgresConnected()) {
      // A user may hold only one OPEN shift per store at a time.
      const openCheck = await pool.query(
        'SELECT 1 FROM shifts WHERE store_id = $1 AND user_id = $2 AND status = $3 LIMIT 1',
        [storeId, userId, 'OPEN']
      );
      if (openCheck.rowCount) {
        return res.status(400).json({ success: false, message: 'Bạn đang có ca mở ở cửa hàng này' });
      }
      const resQuery = await pool.query(
        `INSERT INTO shifts (store_id, user_id, opening_cash, expected_cash, status, notes)
         VALUES ($1, $2, $3, $3, 'OPEN', $4) RETURNING *`,
        [storeId, userId, parsedOpeningCash, notes || '']
      );
      newShift = resQuery.rows[0];
    } else {
      if (memoryStore.shifts.some(s => s.store_id === storeId && s.user_id === userId && s.status === 'OPEN')) {
        return res.status(400).json({ success: false, message: 'Bạn đang có ca mở ở cửa hàng này' });
      }
      newShift = {
        id: memoryStore.shifts.length + 1,
        store_id: storeId,
        user_id: userId,
        opening_time: new Date().toISOString(),
        opening_cash: parsedOpeningCash,
        expected_cash: parsedOpeningCash,
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
  const requesterId = req.user ? req.user.id : null;
  const requesterRole = req.user ? req.user.role : null;

  try {
    let shift = null;
    if (isPostgresConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Lock the shift row and validate existence, ownership and status before updating.
        const shiftRes = await client.query('SELECT * FROM shifts WHERE id = $1 FOR UPDATE', [shiftId]);
        const currentShift = shiftRes.rows[0];
        if (!currentShift) {
          const error = new Error('Không tìm thấy ca làm việc');
          error.statusCode = 404;
          throw error;
        }
        if (Number(currentShift.user_id) !== Number(requesterId) && !['SUPER_ADMIN', 'ADMIN'].includes(requesterRole)) {
          const error = new Error('Bạn chỉ có thể đóng ca của chính mình');
          error.statusCode = 403;
          throw error;
        }
        if (currentShift.status !== 'OPEN') {
          const error = new Error('Ca đã được đóng trước đó');
          error.statusCode = 400;
          throw error;
        }

        // Calculate total cash collected
        const cashRes = await client.query(
          `SELECT COALESCE(SUM(p.amount), 0) as cash_total
           FROM payments p
           JOIN orders o ON p.order_id = o.id
           WHERE o.shift_id = $1 AND p.payment_method = 'CASH' AND p.status = 'SUCCESS'`,
          [shiftId]
        );
        const cashTotal = parseFloat(cashRes.rows[0].cash_total);

        const expectedCash = parseFloat(currentShift.opening_cash) + cashTotal;
        const actualCash = parseFloat(closing_cash);
        const difference = actualCash - expectedCash;

        const updateRes = await client.query(
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
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      shift = memoryStore.shifts.find(s => s.id === shiftId);
      if (!shift) return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm việc' });
      if (Number(shift.user_id) !== Number(requesterId) && !['SUPER_ADMIN', 'ADMIN'].includes(requesterRole)) {
        return res.status(403).json({ success: false, message: 'Bạn chỉ có thể đóng ca của chính mình' });
      }
      if (shift.status !== 'OPEN') {
        return res.status(400).json({ success: false, message: 'Ca đã được đóng trước đó' });
      }

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
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Lỗi kết ca' });
  }
}

module.exports = {
  getCurrentShift,
  openShift,
  closeShift
};
