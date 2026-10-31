const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(database = false) {
  const queries = [];
  const memoryStore = { products: [], categories: [], product_variants: [], product_options: [], product_option_products: [] };
  const client = { query: async (sql, values) => {
    queries.push({ sql, values });
    return { rowCount: 1, rows: [{ id: 1 }] };
  }, release() {} };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/productController.js'), 'utf8'), {
    module, console: { error() {} }, process: { env: {} },
    require: name => name.includes('config/db')
      ? { memoryStore, isPostgresConnected: () => database, pool: { connect: async () => client } }
      : {}
  });
  async function call(method, body = {}, id = 1, storeId = 1) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await module.exports[method]({ body, params: { id }, storeId, query: {}, user: { role: 'ADMIN' } }, res);
    return res;
  }
  return { call, memoryStore, queries };
}

test('product order can be created, changed, preserved, and cleared without crossing stores', async () => {
  const h = harness();
  const created = await h.call('createProduct', { code: 'TS', name: 'Trà sữa', price: 10, sort_order: '0' });
  assert.equal(created.code, 201);
  assert.equal(created.body.product.sort_order, 0);
  await h.call('updateProduct', { sort_order: 2 });
  await h.call('updateProduct', { price: 20 });
  assert.equal(h.memoryStore.products[0].sort_order, 2);
  assert.equal((await h.call('updateProduct', { sort_order: 9 }, 1, 2)).code, 404);
  for (const value of [null, '', '   ']) {
    await h.call('updateProduct', { sort_order: value });
    assert.equal(h.memoryStore.products[0].sort_order, null);
  }
  for (const value of [-1, 1.5, 'bad', true, {}, 2147483648]) {
    assert.equal((await h.call('updateProduct', { sort_order: value })).code, 400);
    assert.equal((await h.call('createProduct', { code: 'X', name: 'X', price: 1, sort_order: value })).code, 400);
  }
});

test('database writes distinguish omitted product order from explicit null', async () => {
  const h = harness(true);
  await h.call('createProduct', { code: 'X', name: 'X', price: 1, sort_order: 3 });
  const insert = h.queries.find(q => q.sql.includes('INSERT INTO products'));
  assert.match(insert.sql, /sort_order/);
  assert.equal(insert.values[10], 3);
  for (const [body, value, provided] of [[{}, null, false], [{ sort_order: null }, null, true], [{ sort_order: '0' }, 0, true]]) {
    await h.call('updateProduct', body);
    const update = h.queries.filter(q => q.sql.includes('UPDATE products')).at(-1);
    assert.match(update.sql, /sort_order=CASE WHEN \$15 THEN \$14 ELSE sort_order END/);
    assert.equal(update.values[13], value);
    assert.equal(update.values[14], provided);
  }
});

test('API and POS apply product order before Vietnamese alphabetic fallback', async () => {
  const h = harness();
  h.memoryStore.products.push(
    { id: 1, name: 'Trà', sort_order: 2 },
    { id: 2, name: 'Bánh' },
    { id: 3, name: 'Gà', sort_order: 0 },
    { id: 4, name: 'Đậu', sort_order: '2' },
    { id: 5, name: 'Cơm', sort_order: null }
  );
  h.memoryStore.products.forEach(p => Object.assign(p, { store_id: 1, is_active: true, code: 'X' }));
  const response = await h.call('getProducts');
  assert.deepEqual(Array.from(response.body.products, p => p.id), [3, 4, 1, 2, 5]);
  const grid = { innerHTML: '', querySelectorAll: () => [] };
  const window = { api: { formatMoney: String }, productImages: { render: () => '' } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/pos.js'), 'utf8'), {
    window, document: { getElementById: id => id === 'productsGrid' ? grid : null }, console
  });
  const pos = window.posModule;
  pos.products = h.memoryStore.products;
  const ids = () => [...grid.innerHTML.matchAll(/class="product-card" data-id="(\d+)"/g)].map(m => Number(m[1]));
  pos.renderProducts();
  assert.deepEqual(ids(), [3, 4, 1, 2, 5]);
  pos.searchKeyword = 'à';
  pos.renderProducts();
  assert.deepEqual(ids(), [3, 1]);
});
