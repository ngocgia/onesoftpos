const { pool, isPostgresConnected, memoryStore } = require('../config/db');

async function getSummary(req, res) {
  const storeId = req.storeId || parseInt(req.query.store_id, 10);
  const range = req.query.range || 'today'; // today, 7days, 30days

  try {
    let revenue = 0;
    let orderCount = 0;
    let paymentBreakdown = { CASH: 0, QR: 0, BANK_TRANSFER: 0, CARD: 0 };
    let topProducts = [];

    if (isPostgresConnected()) {
      let dateFilter = "created_at >= CURRENT_DATE";
      const { startDate, endDate } = req.query;
      if (startDate && endDate) {
        dateFilter = `created_at >= '${startDate} 00:00:00' AND created_at <= '${endDate} 23:59:59'`;
      } else if (range === '7days') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
      } else if (range === '30days') {
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
      }

      // Revenue and order count
      const sumRes = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(id) as count 
         FROM orders 
         WHERE store_id = $1 AND payment_status = 'PAID' AND ${dateFilter}`,
        [storeId]
      );
      revenue = parseFloat(sumRes.rows[0].revenue);
      orderCount = parseInt(sumRes.rows[0].count, 10);

      // Payment breakdown
      const payRes = await pool.query(
        `SELECT payment_method, COALESCE(SUM(amount), 0) as total 
         FROM payments 
         WHERE store_id = $1 AND status = 'SUCCESS' AND ${dateFilter}
         GROUP BY payment_method`,
        [storeId]
      );
      payRes.rows.forEach(r => {
        paymentBreakdown[r.payment_method] = parseFloat(r.total);
      });

      // Top products
      const topRes = await pool.query(
        `SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.store_id = $1 AND o.payment_status = 'PAID' AND o.${dateFilter}
         GROUP BY oi.product_name
         ORDER BY total_qty DESC LIMIT 5`,
        [storeId]
      );
      topProducts = topRes.rows;
    } else {
      const { startDate, endDate } = req.query;
      const todayDate = new Date().toISOString().slice(0, 10);
      let paidOrders = memoryStore.orders.filter(o => o.store_id === storeId && o.payment_status === 'PAID');
      let storePayments = memoryStore.payments.filter(p => p.store_id === storeId && p.status === 'SUCCESS');

      if (startDate && endDate) {
        paidOrders = paidOrders.filter(o => {
          const d = o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : todayDate;
          return d >= startDate && d <= endDate;
        });
        storePayments = storePayments.filter(p => {
          const d = p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : todayDate;
          return d >= startDate && d <= endDate;
        });
      } else if (range === 'today' || !range) {
        paidOrders = paidOrders.filter(o => {
          const d = o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : todayDate;
          return d === todayDate;
        });
        storePayments = storePayments.filter(p => {
          const d = p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : todayDate;
          return d === todayDate;
        });
      }

      revenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      orderCount = paidOrders.length;

      storePayments.forEach(p => {
        paymentBreakdown[p.payment_method] = (paymentBreakdown[p.payment_method] || 0) + (p.amount || 0);
      });

      // Calculate real top products from memoryStore
      const productStats = {};
      paidOrders.forEach(o => {
        const items = memoryStore.order_items.filter(oi => oi.order_id === o.id);
        items.forEach(oi => {
          if (!productStats[oi.product_name]) {
            productStats[oi.product_name] = { product_name: oi.product_name, total_qty: 0, total_revenue: 0 };
          }
          productStats[oi.product_name].total_qty += Number(oi.quantity || 0);
          productStats[oi.product_name].total_revenue += Number(oi.price || 0) * Number(oi.quantity || 0);
        });
      });

      topProducts = Object.values(productStats)
        .sort((a, b) => b.total_qty - a.total_qty)
        .slice(0, 5);
    }

    res.json({
      success: true,
      revenue,
      orderCount,
      avgOrderValue: orderCount > 0 ? Math.round(revenue / orderCount) : 0,
      paymentBreakdown,
      topProducts
    });
  } catch (error) {
    console.error('getSummary report error:', error);
    res.status(500).json({ success: false, message: 'Lỗi lấy báo cáo doanh thu' });
  }
}

module.exports = {
  getSummary
};
