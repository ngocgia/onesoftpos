const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('table reload repairs paid and cancelled links and preserves unpaid kitchen orders', async () => {
  const orders = [
    { id: 1, payment_status: 'PAID', order_status: 'PREPARING' },
    { id: 2, payment_status: 'UNPAID', order_status: 'CANCELLED' },
    { id: 3, payment_status: 'UNPAID', order_status: 'PREPARING', total_amount: 95000 }
  ];
  const tables = orders.map(order => ({ id: order.id, store_id: 11, current_order_id: order.id, status: 'OCCUPIED' }));
  orders.forEach(order => { order.store_id = 11; });
  tables.push({ id: 4, store_id: 12, current_order_id: 1, status: 'OCCUPIED' });
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/tableController.js'), 'utf8'), {
    require: () => ({ isPostgresConnected: () => false, memoryStore: { orders, tables, areas: [] } }), module, console
  });
  const res = { json(data) { this.data = data; } };
  await module.exports.getTables({ storeId: 11 }, res);
  assert.equal(res.data.success, true);
  for (const id of [1, 2]) {
    const table = res.data.tables.find(table => table.id === id);
    assert.equal(table.current_order_id, null);
    assert.equal(table.status, 'EMPTY');
    assert.equal(table.total_amount, 0);
  }
  assert.equal(res.data.tables.find(table => table.id === 3).current_order_id, 3);
  assert.equal(tables[3].current_order_id, 1);
});
