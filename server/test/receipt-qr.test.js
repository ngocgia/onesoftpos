const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness(database = false) {
  const records = [
    { store_id: 11, bank_name: 'MB Bank', bank_account_number: '0123456789', bank_account_holder: 'NGUYEN VAN A' },
    { store_id: 12, bank_name: 'ACB', bank_account_number: '999999', bank_account_holder: 'TRAN VAN B' }
  ];
  const db = {
    isPostgresConnected: () => database, memoryStore: { store_settings: records },
    pool: { query: async (sql, args) => ({ rows: records.filter(record => record.store_id === args[0]) }) }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/paymentController.js'), 'utf8'), {
    module, require: name => name.includes('config/db') ? db : {}, console
  });
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });
  return { controller: module.exports, records, response };
}

for (const database of [false, true]) {
  test(`receipt QR uses the selected store account, exact amount and escaped memo (${database ? 'database' : 'memory'})`, async () => {
    const h = harness(database);
    for (const storeId of [11, 12]) {
      const res = h.response();
      await h.controller.previewReceiptVietQR({ storeId, body: { amount: 50000, memo: 'HD001 & Bàn 04' } }, res);
      assert.equal(res.body.configured, true);
      const url = new URL(res.body.qrUrl);
      assert.equal(url.hostname, 'img.vietqr.io');
      assert.equal(url.searchParams.get('amount'), '50000');
      assert.equal(url.searchParams.get('addInfo'), 'HD001 & Bàn 04');
      assert.match(url.pathname, new RegExp(storeId === 11 ? '970422-0123456789' : '970416-999999'));
    }
  });
}

test('receipt QR has no fallback account when bank configuration is absent or unknown', async () => {
  const h = harness();
  for (const bankName of ['', 'Unknown Bank']) {
    h.records[0].bank_name = bankName;
    const res = h.response();
    await h.controller.previewReceiptVietQR({ storeId: 11, body: { amount: 50000, memo: 'HD001' } }, res);
    assert.equal(res.body.configured, false);
    assert.equal(res.body.qrUrl, undefined);
  }
});

test('receipt QR rejects malformed totals and transfer descriptions', async () => {
  const h = harness();
  for (const body of [
    { amount: 0, memo: 'HD1' }, { amount: -1, memo: 'HD1' },
    { amount: 1.5, memo: 'HD1' }, { amount: Infinity, memo: 'HD1' },
    { amount: 50000, memo: '' }, { amount: 50000, memo: 'x'.repeat(101) }
  ]) {
    const res = h.response();
    await h.controller.previewReceiptVietQR({ storeId: 11, body }, res);
    assert.equal(res.statusCode, 400);
  }
});
