const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../../public/js/menu-persistence.js'), 'utf8');

function harness(failWrite = false) {
  const elements = new Map();
  const calls = [], toasts = [];
  const menu = new Proxy({}, { get(target, key) { return target[key] || (() => {}); } });
  const window = { moreMenuModule: menu, appState: { user: { role: 'STORE_MANAGER' } }, appNavigation: { reloadCurrentStoreFeatures: async () => {} }, api: {
    getCurrentStoreId: () => '11',
    get: async () => ({ settings: {} }),
    put: async (url, body) => { calls.push({ url, body }); if (failWrite) throw new Error('offline'); return { settings: body }; },
    showToast: (message, kind) => toasts.push({ message, kind })
  } };
  const document = { getElementById(id) {
    if (!elements.has(id)) {
      const tag = html.match(new RegExp('<[^>]+id="' + id + '"[^>]*>'))?.[0];
      assert.ok(tag, `Missing control ${id}`);
      elements.set(id, { type: tag.match(/type="([^"]+)"/)?.[1] || 'text', style: { display: 'flex' }, querySelectorAll: () => [], value: '', checked: false });
    }
    return elements.get(id);
  } };
  vm.runInNewContext(source, { window, document });
  return { window, document, calls, toasts };
}

test('all menu configuration controls exist and numeric/boolean values round trip through database API', async () => {
  const { window, document, calls } = harness();
  const persistence = window.menuPersistence;
  await persistence.loadStore();
  for (const section of Object.keys(persistence.fields)) {
    for (const id of Object.values(persistence.fields[section])) document.getElementById(id);
  }
  document.getElementById('shipFee').value = '15000';
  document.getElementById('shipGrab').checked = true;
  await window.moreMenuModule.saveShippingSettings();
  assert.equal(calls[0].url, '/store/menu-settings/shipping');
  assert.equal(calls[0].body.fee, 15000);
  assert.equal(calls[0].body.grab, true);
  document.getElementById('shipFee').value = '0';
  persistence.populate('shipping');
  assert.equal(document.getElementById('shipFee').value, 15000);
  assert.equal(document.getElementById('shippingPartnersModal').style.display, 'none');
});

test('failed save keeps the dialog open and never shows success', async () => {
  const { window, document, toasts } = harness(true);
  await window.menuPersistence.loadStore();
  document.getElementById('shipFee').value = '15000';
  await window.moreMenuModule.saveShippingSettings();
  assert.equal(document.getElementById('shippingPartnersModal').style.display, 'flex');
  assert.ok(toasts.some(toast => toast.kind === 'error'));
  assert.ok(!toasts.some(toast => toast.kind === 'success'));
});
