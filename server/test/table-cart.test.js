const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness(storage = new Map()) {
  const calls = [], elements = new Map();
  for (const id of ['cartItemsList', 'cartEmptyState', 'cartSubtotal', 'cartGrandTotal', 'btnSendKitchen']) {
    elements.set(id, { style: {}, innerHTML: '', appendChild() {}, querySelectorAll: () => [] });
  }
  const document = { getElementById: id => elements.get(id) || null, querySelectorAll: () => [] };
  const localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const window = { api: {
    getCurrentStoreId: () => '11', formatMoney: value => String(value), showToast() {},
    put: async (url, body) => { calls.push({ url, body }); return { success: true }; },
    get: async () => ({ order: { id: 77, subtotal: 50000, total_amount: 50000, payment_status: 'UNPAID' }, items: [
      { product_id: 8, product_name: 'Món cũ', unit_price: 50000, subtotal: 50000, quantity: 1, status: 'READY' },
      { product_name: 'Món đã hủy', quantity: 1, status: 'CANCELLED' }
    ] }),
    post: async (url, body) => { calls.push({ url, body }); return { order: { id: 77, subtotal: 70000, total_amount: 70000 } }; }
  }, appNavigation: { switchView() {} } };
  const context = vm.createContext({ window, document, localStorage, console });
  for (const file of ['state', 'tables', 'pos']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, `../../public/js/${file}.js`), 'utf8'), context);
  }
  const state = window.appState;
  state.currentStore = { id: 11 };
  state.user = { id: 3, role: 'CASHIER' };
  state.features.enableDineIn = state.features.enableTable = true;
  window.tablesModule.loadAreasAndTables = async () => {};
  return { window, state, calls, storage, elements };
}
const item = { product_id: 1, product_name: 'Gà', unit_price: 20000, quantity: 1 };
const table = id => ({ id, code: `B${id}`, status: 'EMPTY', current_order_id: null });
const flush = async tables => { await Promise.all([...tables.draftStatusQueue.values()]); };

test('table card and action summary show unsent food after leaving and reloading', async () => {
  const { window, state, storage } = harness();
  state.setSelectedTable(table(1));
  state.addToCart(item);
  state.addToCart(item);
  state.setSelectedTable(table(2));
  const reloaded = harness(storage);
  const tables = reloaded.window.tablesModule;
  const active = { ...table(1), status: 'OCCUPIED', total_amount: 0 };
  tables.tables = [active];
  for (const id of ['tablesGrid', 'tableBillOverview', 'tableBillAmount', 'tableBillOrderCode']) {
    reloaded.elements.set(id, { style: {}, innerHTML: '', querySelectorAll: () => [] });
  }
  tables.renderTables();
  assert.match(reloaded.elements.get('tablesGrid').innerHTML, /40000/);
  assert.match(reloaded.elements.get('tablesGrid').innerHTML, /Món chưa gửi/);
  tables.openTableActionModal(active);
  assert.equal(reloaded.elements.get('tableBillAmount').textContent, '40000');
  assert.equal(reloaded.elements.get('tableBillOrderCode').textContent, 'MÓN CHƯA GỬI');
  assert.equal(reloaded.calls.length, 0);
  await flush(window.tablesModule);
});

test('table summary combines sent and unsent food, applies draft discount and clears removed food', () => {
  const { window, state } = harness();
  const active = { ...table(1), current_order_id: 77, status: 'OCCUPIED', total_amount: '50000' };
  state.setSelectedTable(active);
  state.addToCart(item);
  state.cart.discountPercent = 10;
  state.cart.discountCash = 1000;
  assert.equal(window.tablesModule.getTableSummary(active).total, 67000);
  assert.equal(window.tablesModule.getTableSummary(active, '60000').total, 77000);
  state.updateCartItemQty(0, -1);
  assert.equal(window.tablesModule.getTableSummary(active).total, 50000);
  assert.equal(window.tablesModule.getTableSummary(active).hasDraft, false);
});

test('free unsent food is still identified as a draft', () => {
  const { window, state } = harness();
  state.setSelectedTable(table(1));
  state.addToCart({ ...item, unit_price: 0 });
  const summary = window.tablesModule.getTableSummary(table(1));
  assert.equal(summary.hasDraft, true);
  assert.equal(summary.total, 0);
  assert.equal(summary.status, 'OCCUPIED');
});

test('adding food occupies table before kitchen submission and restores each table draft after reload', async () => {
  const { window, state, calls, storage } = harness();
  state.setSelectedTable(table(1));
  state.addToCart(item);
  await flush(window.tablesModule);
  assert.equal(state.cart.selectedTable.status, 'OCCUPIED');
  assert.equal(calls[0].url, '/tables/1/status');
  assert.equal(calls[0].body.status, 'OCCUPIED');
  assert.ok(!calls.some(call => call.url === '/orders'));
  state.setSelectedTable(table(2));
  assert.equal(state.cart.items.length, 0);
  state.addToCart({ ...item, product_id: 2 });
  state.setSelectedTable(table(1));
  assert.equal(state.cart.items[0].product_id, 1);
  const reloaded = harness(storage);
  reloaded.state.setSelectedTable({ ...table(1), status: 'OCCUPIED' });
  assert.equal(reloaded.state.cart.items[0].product_id, 1);
  reloaded.state.updateCartItemQty(0, -1);
  await flush(reloaded.window.tablesModule);
  assert.equal(reloaded.state.cart.selectedTable.status, 'EMPTY');
  assert.equal(reloaded.calls.at(-1).body.status, 'EMPTY');
  reloaded.state.currentStore = { id: 12 };
  assert.equal(reloaded.state.getTableCart(2), null);
});

test('opening a table shows sent items, excludes cancelled food, and sends only new food once', async () => {
  const { window, state, calls, elements } = harness();
  const active = { ...table(1), current_order_id: 77, status: 'OCCUPIED' };
  await window.tablesModule.openTablePos(active);
  window.posModule.renderCart();
  assert.ok(elements.get('cartItemsList').innerHTML.includes('Món cũ'));
  assert.ok(!elements.get('cartItemsList').innerHTML.includes('Món đã hủy'));
  assert.equal(elements.get('btnSendKitchen').disabled, true);
  state.addToCart(item);
  window.posModule.renderCart();
  assert.equal(elements.get('cartGrandTotal').textContent, '70000');
  await Promise.all([window.posModule.sendOrderToKitchen(), window.posModule.sendOrderToKitchen()]);
  const submitted = calls.filter(call => call.url === '/orders');
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].body.items.length, 1);
  assert.equal(submitted[0].body.items[0].product_id, 1);
  assert.equal(state.cart.items.length, 0);
  assert.equal(state.cart.sentItems.length, 2);
  window.posModule.renderCart();
  assert.ok(elements.get('cartItemsList').innerHTML.includes('Món cũ'));
  assert.ok(elements.get('cartItemsList').innerHTML.includes('Gà'));
  assert.equal(elements.get('btnSendKitchen').disabled, true);
  assert.ok(!calls.some(call => call.url.endsWith('/status')));
});

test('opening a reserved table without food preserves reservation', () => {
  const { state, calls } = harness();
  state.setSelectedTable({ ...table(1), status: 'RESERVED' });
  assert.equal(state.cart.selectedTable.status, 'RESERVED');
  assert.equal(calls.length, 0);
});

test('failed kitchen submission keeps unsent food and restores send button', async () => {
  const { window, state, elements } = harness();
  state.setSelectedTable(table(1));
  state.addToCart(item);
  let prints = 0;
  window.invoiceModule = { showOrderSlip: async () => prints++ };
  window.api.post = async () => { throw new Error('offline'); };
  await window.posModule.sendOrderToKitchen();
  assert.equal(state.cart.items.length, 1);
  assert.equal(state.cart.sentItems.length, 0);
  assert.equal(elements.get('btnSendKitchen').disabled, false);
  assert.equal(prints, 0);
});

test('successful transfer prints only submitted food after cart clears, once', async () => {
  const { window, state } = harness();
  state.setSelectedTable(table(4));
  state.cart.sentItems = [{ product_name: 'Món cũ', quantity: 2 }];
  state.addToCart(item);
  const slips = [];
  window.invoiceModule = { showOrderSlip: async (order, items, options) => {
    assert.equal(state.cart.items.length, 0);
    slips.push({ order, items, options });
  } };
  await Promise.all([window.posModule.sendOrderToKitchen(), window.posModule.sendOrderToKitchen()]);
  assert.equal(slips.length, 1);
  assert.equal(slips[0].order.id, 77);
  assert.equal(slips[0].order.table_name, 'B4');
  assert.equal(slips[0].items.length, 1);
  assert.equal(slips[0].items[0].product_name, 'Gà');
  assert.equal(slips[0].options.auto, true);
  assert.equal(slips[0].options.storeId, '11');
});

function statusController(db) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/tableController.js'), 'utf8'), {
    require: () => db, module, console
  });
  return module.exports;
}
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } });

test('draft status updates are store scoped and cannot empty a table with an order', async () => {
  const tables = [{ ...table(1), store_id: 11 }, { ...table(2), store_id: 12 }, { ...table(3), store_id: 11, current_order_id: 77, status: 'OCCUPIED' }];
  const controller = statusController({ isPostgresConnected: () => false, memoryStore: { tables } });
  const req = { params: { id: '1' }, storeId: 11, body: { status: 'OCCUPIED', draft: true } };
  const saved = response(); await controller.updateTableStatus(req, saved);
  assert.equal(saved.statusCode, 200);
  assert.equal(tables[0].status, 'OCCUPIED');
  const otherStore = response(); await controller.updateTableStatus({ ...req, params: { id: '2' } }, otherStore);
  assert.equal(otherStore.statusCode, 404);
  const occupied = response(); await controller.updateTableStatus({ ...req, params: { id: '3' }, body: { status: 'EMPTY', draft: true } }, occupied);
  assert.equal(occupied.statusCode, 409);
  assert.equal(tables[2].status, 'OCCUPIED');
  const invalid = response(); await controller.updateTableStatus({ ...req, body: { status: 'INVALID' } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test('database draft update checks store and existing order atomically', async () => {
  let query, values;
  const controller = statusController({ isPostgresConnected: () => true, pool: { query: async (sql, args) => {
    query = sql; values = args; return { rowCount: 1 };
  } } });
  await controller.updateTableStatus({ params: { id: '4' }, storeId: 11, body: { status: 'OCCUPIED', draft: true } }, response());
  assert.ok(query.includes('store_id = $3'));
  assert.ok(query.includes('current_order_id IS NULL'));
  assert.deepEqual(Array.from(values), ['OCCUPIED', 4, 11]);
});
