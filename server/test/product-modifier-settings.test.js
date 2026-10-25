const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function posHarness(settings = {}) {
  const document = { getElementById: () => null, querySelectorAll: () => [] };
  const toasts = [];
  const window = { api: { showToast: message => toasts.push(message) } };
  const context = vm.createContext({ window, document, console });
  for (const file of ['state', 'pos']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, `../../public/js/${file}.js`), 'utf8'), context);
  }
  const state = window.appState;
  state.storeSettings = settings;
  state.features.enableDineIn = true;
  const pos = window.posModule;
  const effects = [], popups = [];
  pos.animateAddToCart = (...args) => effects.push(args);
  pos.openModifierModal = product => popups.push(product);
  return { pos, state, toasts, effects, popups, document };
}

const product = {
  id: 12, name: 'Trà sữa', price: '32000', kitchen_type: 'BAR',
  variants: [
    { id: 1, size_name: 'S', price_adjustment: '0', is_default: false },
    { id: 2, size_name: 'M', price_adjustment: '5000', is_default: true }
  ],
  options: [{ id: 8, name: 'Trân châu', price: 5000 }]
};

test('popup remains enabled by default and when explicitly enabled', () => {
  for (const settings of [null, {}, { product_modifier_popup_enabled: true }]) {
    const h = posHarness(settings);
    h.pos.addProductFromCatalog(product);
    assert.equal(h.popups.length, 1);
    assert.equal(h.state.cart.items.length, 0);
  }
});

test('disabled popup adds default variant without extras, merging repeated plus clicks', () => {
  const h = posHarness({ product_modifier_popup_enabled: false });
  h.pos.addProductFromCatalog(product);
  h.pos.addProductFromCatalog(product);
  assert.equal(h.popups.length, 0);
  assert.equal(h.state.cart.items.length, 1);
  const item = h.state.cart.items[0];
  assert.equal(item.variant_id, 2);
  assert.equal(item.unit_price, 37000);
  assert.equal(item.quantity, 2);
  assert.equal(item.subtotal, 74000);
  assert.equal(item.note, '');
  assert.equal(item.options.length, 0);
  assert.equal(h.effects.length, 2);
  assert.equal(h.toasts.length, 2);
});

test('quick add supports no variants and falls back to the first variant', () => {
  const h = posHarness({ product_modifier_popup_enabled: false });
  h.pos.addProductFromCatalog({ ...product, variants: [] });
  h.pos.addProductFromCatalog({ ...product, variants: [{ id: 3, size_name: 'L', price_adjustment: '10000' }] });
  assert.equal(h.state.cart.items[0].variant_id, null);
  assert.equal(h.state.cart.items[0].subtotal, 32000);
  assert.equal(h.state.cart.items[1].variant_id, 3);
  assert.equal(h.state.cart.items[1].subtotal, 42000);
});

test('modal confirmation preserves quantity, note and toppings with add feedback', () => {
  const h = posHarness();
  h.pos.activeModalProduct = product;
  h.pos.selectedVariant = product.variants[1];
  h.pos.selectedOptions = [{ option_id: 8, option_name: 'Trân châu', price: 5000 }];
  h.pos.modalQty = 3;
  h.document.getElementById = id => id === 'modifierItemNote' ? { value: '  Ít đá  ' } : null;
  h.pos.confirmAddFromModal();
  const item = h.state.cart.items[0];
  assert.equal(item.subtotal, 126000);
  assert.equal(item.note, 'Ít đá');
  assert.equal(item.options[0].option_id, 8);
  assert.equal(h.effects[0][2], 3);
  assert.equal(h.pos.activeModalProduct, null);
});

test('settings follow the current store and sending orders block additions and feedback', () => {
  const h = posHarness({ product_modifier_popup_enabled: false });
  h.pos.addProductFromCatalog(product);
  h.state.storeSettings = { product_modifier_popup_enabled: true };
  h.pos.addProductFromCatalog(product);
  assert.equal(h.popups.length, 1);
  h.state.storeSettings.product_modifier_popup_enabled = false;
  h.pos.sendingOrder = true;
  h.pos.addProductFromCatalog(product);
  h.pos.activeModalProduct = product;
  h.pos.confirmAddFromModal();
  assert.equal(h.state.cart.items[0].quantity, 1);
  assert.equal(h.effects.length, 1);
  assert.equal(h.toasts.length, 1);
});

function settingsHarness(database = false) {
  const records = [{ store_id: 11 }, { store_id: 12, product_modifier_popup_enabled: true }];
  const calls = [];
  const db = {
    isPostgresConnected: () => database,
    memoryStore: { store_settings: records },
    pool: { query: async (sql, args) => { calls.push({ sql, args }); return { rows: [], rowCount: 1 }; } }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/storeController.js'), 'utf8'), {
    module, require: name => name.includes('config/db') ? db : {}, console
  });
  const save = async (body, role = 'ADMIN') => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
    await module.exports.updateStoreSettings({ params: { id: '11' }, user: { role }, body }, res);
    return res;
  };
  return { records, calls, save };
}

test('store setting saves independently, preserves false on partial updates, and can be re-enabled', async () => {
  const h = settingsHarness();
  assert.equal((await h.save({ product_modifier_popup_enabled: false })).statusCode, 200);
  assert.equal(h.records[0].product_modifier_popup_enabled, false);
  assert.equal(h.records[1].product_modifier_popup_enabled, true);
  await h.save({ receipt_footer: 'Cảm ơn' });
  assert.equal(h.records[0].product_modifier_popup_enabled, false);
  await h.save({ product_modifier_popup_enabled: 'true' });
  assert.equal(h.records[0].product_modifier_popup_enabled, true);
});

test('database saves bind false and store ID correctly and preserve omitted setting', async () => {
  const h = settingsHarness(true);
  await h.save({ product_modifier_popup_enabled: 'false' });
  assert.match(h.calls[0].sql, /product_modifier_popup_enabled = COALESCE\(\$15,/);
  assert.match(h.calls[0].sql, /WHERE store_id = \$16/);
  assert.equal(h.calls[0].args[14], false);
  assert.equal(h.calls[0].args[15], 11);
  await h.save({ receipt_footer: 'Cảm ơn' });
  assert.equal(h.calls[1].args[14], undefined);
});

test('popup configuration rejects invalid values and non-admin roles', async () => {
  const h = settingsHarness();
  for (const value of [null, 'off', 0, {}]) {
    assert.equal((await h.save({ product_modifier_popup_enabled: value })).statusCode, 400);
  }
  assert.equal((await h.save({ product_modifier_popup_enabled: false }, 'STORE_MANAGER')).statusCode, 403);
  assert.equal(h.records[0].product_modifier_popup_enabled, undefined);
});
