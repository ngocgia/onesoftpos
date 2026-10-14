const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const workflow = require('../src/services/workflowService');

for (const scenario of [
  { name: 'existing decimal amounts with discount and tax', discount: 5000, tax: 2000, expected: 69000 },
  { name: 'discount larger than subtotal clamps total to zero', discount: 100000, tax: 0, expected: 0 },
  { name: 'no discount or tax', discount: 0, tax: 0, expected: 72000 }
]) {
  test(`appending food to an existing table order: ${scenario.name}`, async () => {
    const existingOrder = { id: 77, subtotal: '50000.00', discount_amount: '0.00', tax_amount: '0.00' };
    const calls = [];
    const client = {
      release() {},
      async query(sql, values) {
        calls.push({ sql, values });
        // Model PostgreSQL's failure when arithmetic operands are untyped parameters.
        if (/\$\d+\s*-\s*\$\d+/.test(sql)) throw new Error('operator is not unique: unknown - unknown');
        if (sql.includes('SELECT current_order_id FROM tables')) return { rows: [{ current_order_id: 77 }] };
        if (sql.includes('SELECT * FROM orders')) return { rows: [existingOrder] };
        if (sql.includes('SELECT id FROM shifts')) return { rows: [{ id: 1 }] };
        if (sql.includes('INSERT INTO order_items')) return { rows: [{ id: 90 }] };
        if (sql.includes('UPDATE orders SET subtotal=')) {
          return { rows: [{ ...existingOrder, subtotal: values[0], discount_amount: values[1], tax_amount: values[2], total_amount: values[6] }] };
        }
        return { rows: [], rowCount: 1 };
      }
    };
    const db = { isPostgresConnected: () => true, pool: {
      connect: async () => client,
      query: async sql => ({ rows: sql.includes('ss.workflow_definition') ? [{}] : [] })
    } };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/orderController.js'), 'utf8'), {
      require: name => name === '../config/db' ? db : workflow, module, console
    });
    const req = { storeId: 11, user: { id: 3, role: 'SUPER_ADMIN' }, body: {
      order_type: 'DINE_IN', table_id: 4, existing_order_id: 77,
      discount_amount: scenario.discount, tax_amount: scenario.tax,
      items: [{ product_id: 2, product_name: 'Gà', unit_price: 11000, quantity: 2 }]
    } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
    await module.exports.createOrder(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.data.order.id, 77);
    assert.equal(res.data.order.subtotal, 72000);
    assert.equal(res.data.order.total_amount, scenario.expected);
    const update = calls.find(call => call.sql.includes('UPDATE orders SET subtotal='));
    assert.ok(update.sql.includes('total_amount=$7'));
    assert.equal(update.values[6], scenario.expected);
    assert.ok(calls.some(call => call.sql === 'COMMIT'));
    assert.ok(!calls.some(call => call.sql === 'ROLLBACK'));
    assert.equal(calls.filter(call => call.sql.includes('INSERT INTO order_items')).length, 1);
    assert.ok(!calls.some(call => call.sql.includes('INSERT INTO orders')));
  });
}
