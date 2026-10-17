const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const workflow = require('../src/services/workflowService');

for (const orderType of ['TAKEAWAY', 'DINE_IN']) {
for (const unfinished of [true, false]) {
  test(`${orderType} payment ${unfinished ? 'preserves kitchen work' : 'completes a finished order'} and releases its table`, async () => {
    const calls = [];
    const order = {
      id: 10, table_id: orderType === 'DINE_IN' ? 4 : null, order_type: orderType, payment_status: 'UNPAID', order_status: 'CONFIRMED',
      workflow_stage_index: 1, workflow_snapshot: workflow.DEFAULT_WORKFLOW, total_amount: '50000.00'
    };
    let released = false;
    const client = {
      release() { released = true; },
      async query(sql, values) {
        calls.push({ sql, values });
        if (sql.includes('SELECT * FROM orders')) return { rows: [order] };
        if (sql.includes('INSERT INTO payments')) return { rows: [{ id: 20, amount: values[3], cash_return: values[5], status: 'SUCCESS' }] };
        if (sql.includes('SELECT 1 FROM order_items')) return { rows: unfinished ? [{}] : [] };
        if (sql.includes('UPDATE orders')) {
          // The status parameter must not also infer text from a CASE comparison.
          assert.ok(!/CASE WHEN \$3\s*=/.test(sql));
          assert.ok(sql.includes('CASE WHEN $4 THEN'));
          assert.equal(typeof values[3], 'boolean');
          assert.equal(values[3], !unfinished);
          return { rows: [{ ...order, payment_status: 'PAID', order_status: values[2], workflow_stage_index: values[1] }] };
        }
        return { rows: [] };
      }
    };
    const db = { isPostgresConnected: () => true, pool: { connect: async () => client } };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/paymentController.js'), 'utf8'), {
      require: name => name === '../config/db' ? db : workflow, module, console
    });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
    await module.exports.processPayment({ storeId: 11, user: { id: 3, role: 'SUPER_ADMIN' }, body: {
      order_id: 10, amount: 50000, cash_received: 100000, payment_method: 'CASH'
    } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.order.payment_status, 'PAID');
    assert.equal(res.data.order.order_status, unfinished ? 'PREPARING' : 'COMPLETED');
    assert.equal(res.data.order.workflow_stage_index, unfinished ? 1 : workflow.DEFAULT_WORKFLOW.steps.length);
    assert.equal(res.data.change, 50000);
    assert.equal(res.data.payment.amount, 50000);
    assert.equal(calls.filter(call => call.sql.includes('INSERT INTO payments')).length, 1);
    const release = calls.find(call => call.sql.includes('UPDATE tables'));
    assert.equal(!!release, orderType === 'DINE_IN');
    if (release) {
      assert.match(release.sql, /current_order_id=\$2/);
      assert.deepEqual(Array.from(release.values), [4, 10]);
    }
    assert.ok(calls.some(call => call.sql === 'COMMIT'));
    assert.ok(!calls.some(call => call.sql === 'ROLLBACK'));
    assert.equal(released, true);
  });
}
}
