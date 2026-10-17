const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const workflow = require('../src/services/workflowService');

for (const database of [false, true]) {
  test(`one-click kitchen completion records cook and keeps unpaid order open (${database ? 'database' : 'memory'})`, async () => {
    const item = { id: 1, order_id: 10, status: 'PENDING', product_name: 'Gà', quantity: 1 };
    const order = { id: 10, store_id: 11, order_type: 'DINE_IN', order_status: 'CONFIRMED', payment_status: 'UNPAID', workflow_snapshot: workflow.DEFAULT_WORKFLOW, workflow_stage_index: 1 };
    const queries = [];
    const client = {
      release() {},
      async query(sql, values) {
        queries.push(sql);
        if (sql.includes('FOR UPDATE OF')) return { rows: [{ ...item, ...order, order_id: 10, item_status: 'PENDING' }] };
        if (sql.includes('UPDATE order_items')) {
          item.status = values[0];
          assert.equal(values[2], 3);
          assert.match(sql, /prepared_by = CASE/);
          assert.match(sql, /prepared_at = CASE/);
        }
        if (sql.includes('SELECT status FROM order_items')) return { rows: [{ status: item.status }] };
        if (sql.includes('UPDATE orders')) {
          order.order_status = values[0];
          return { rows: [order] };
        }
        return { rows: [] };
      }
    };
    const db = { isPostgresConnected: () => database, pool: { connect: async () => client }, memoryStore: {
      order_items: [item], orders: [order], tables: [], store_settings: []
    } };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/kdsController.js'), 'utf8'), {
      require: name => name === '../config/db' ? db : workflow, module, console, process
    });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
    await module.exports.updateKdsItemStatus({ params: { itemId: '1' }, storeId: 11, user: { id: 3, role: 'KITCHEN' }, body: { status: 'READY' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.item.status, 'READY');
    assert.equal(res.data.order.payment_status, 'UNPAID');
    assert.notEqual(res.data.order.order_status, 'COMPLETED');
    assert.match(res.data.announcement, /Gà/);
    if (database) assert.ok(queries.includes('COMMIT'));
    else {
      assert.equal(item.prepared_by, 3);
      assert.ok(item.prepared_at);
    }
  });
}

test('kitchen offers only completion and icon cancellation, hides completed dishes', () => {
  const grid = { innerHTML: '', querySelectorAll: () => [] };
  const window = { appState: { user: { role: 'KITCHEN' }, storeSettings: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/kds.js'), 'utf8'), {
    window, document: { getElementById: () => grid }, console
  });
  window.kdsModule.orders = [{ created_at: new Date().toISOString(), items: [
    { id: 1, status: 'PENDING', product_name: 'Gà', quantity: 1 },
    { id: 2, status: 'PREPARING', product_name: 'Cơm', quantity: 1 },
    { id: 3, status: 'READY', product_name: 'Món đã xong', quantity: 1 }
  ] }];
  window.kdsModule.renderOrders();
  assert.equal((grid.innerHTML.match(/data-next="READY"/g) || []).length, 2);
  assert.doesNotMatch(grid.innerHTML, /Bắt đầu làm|Đã trả món|Món đã xong/);
  assert.match(grid.innerHTML, /aria-label="Hủy món"/);
  assert.doesNotMatch(grid.innerHTML, /<\/i> Hủy/);
});
