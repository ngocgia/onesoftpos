const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness() {
  let storeId = '11';
  let prints = 0;
  const settings = new Map();
  const elements = new Map();
  const toasts = [];
  const document = {
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, {
        style: {}, value: '', checked: false, querySelectorAll: () => [],
        addEventListener(event, handler) { this[event] = handler; }
      });
      return elements.get(id);
    },
    querySelector: () => null,
    createElement: () => ({}),
    head: { appendChild: element => elements.set(element.id, element) }
  };
  const window = {
    print: () => prints++,
    appState: { currentStore: { name: 'Test' }, storeSettings: {}, user: { role: 'ADMIN' } },
    api: {
      getCurrentStoreId: () => storeId,
      get: async url => url.startsWith('/orders/')
        ? { order: { id: 1, order_code: 'TEST', items: [] }, items: [] }
        : { settings: url.endsWith('/printer') ? settings.get(storeId) : { printer: settings.get(storeId) } },
      put: async (url, body) => { settings.set(storeId, { ...body }); return { settings: body }; },
      showToast: (message, type) => toasts.push({ message, type }),
      formatMoney: value => String(value || 0)
    }
  };
  for (const file of ['more-menu.js', 'menu-persistence.js', 'invoice.js', 'orders.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js', file), 'utf8'), { window, document, console });
  }
  return { window, document, settings, toasts, prints: () => prints, switchStore: id => { storeId = id; } };
}

test('saved printer settings apply to draft, reprint and subsequent changes from another cashier', async () => {
  const h = harness();
  await h.window.moreMenuModule.openPrinterModal();
  h.document.getElementById('printerPaperSize').value = 'K58';
  h.document.getElementById('printerConnectionType').value = 'browser';
  h.document.getElementById('printerAutoPrint').checked = false;
  await h.window.moreMenuModule.savePrinterSettings();
  assert.equal(h.settings.get('11').paperSize, 'K58');
  await h.window.invoiceModule.showReceipt({ isDraft: true, items: [] });
  assert.match(h.document.getElementById('receiptPrintSettings').textContent, /width: 54mm/);
  assert.equal(h.window.appState.storeSettings.receipt_paper_size, '58mm');
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  h.settings.set('11', { paperSize: 'A4', autoPrintOnPayment: false });
  await h.window.invoiceModule.printReceipt();
  assert.match(h.document.getElementById('receiptPrintSettings').textContent, /size: A4/);
  assert.equal(h.prints(), 2);
  assert.equal(h.toasts.filter(t => t.type === 'error').length, 0);
});

test('history reprint button opens and prints with the store paper size and correct label', async () => {
  const h = harness();
  const button = { getAttribute: () => '1', addEventListener(event, handler) { this[event] = handler; } };
  h.document.getElementById('ordersTableBody').querySelectorAll = selector => selector === '.btn-reprint' ? [button] : [];
  h.window.ordersModule.orders = [{ id: 1, order_code: 'TEST', payment_status: 'PAID', created_at: '2026-10-10' }];
  h.window.ordersModule.renderOrdersTable();
  h.window.invoiceModule.bindEvents();
  for (const [paperSize, label, page] of [
    ['K58', '58mm', '58mm 297mm'], ['K80', '80mm', '80mm 297mm'], ['A4', 'A4', 'A4']
  ]) {
    h.settings.set('11', { paperSize, autoPrintOnPayment: true });
    await button.click();
    assert.equal(h.document.getElementById('receiptPrintLabel').textContent, `In Hóa Đơn (${label})`);
    assert.ok(h.document.getElementById('receiptPrintSettings').textContent.includes(`size: ${page};`));
    assert.equal(h.prints(), ['K58', 'K80', 'A4'].indexOf(paperSize));
    await h.document.getElementById('btnPrintReceiptBtn').click();
  }
  assert.equal(h.prints(), 3);
});

test('auto print follows store setting only for payment, never for drafts or history', async () => {
  const h = harness();
  h.settings.set('11', { paperSize: 'K80', autoPrintOnPayment: false });
  await h.window.invoiceModule.showReceipt({ id: 1 }, {}, 0, { autoPrint: true });
  assert.equal(h.prints(), 0);
  h.settings.set('11', { paperSize: 'K58', autoPrintOnPayment: true });
  await h.window.invoiceModule.showReceipt({ id: 1 }, {}, 0, { autoPrint: true });
  assert.equal(h.prints(), 1);
  await h.window.invoiceModule.showReceipt({ id: 1 });
  await h.window.invoiceModule.showReceipt({ isDraft: true }, null, 0, { autoPrint: true });
  assert.equal(h.prints(), 1);
});

test('switching stores uses its own settings and blocks printing the previous store receipt', async () => {
  const h = harness();
  h.settings.set('11', { paperSize: 'K58' });
  h.settings.set('12', { paperSize: 'K80' });
  await h.window.invoiceModule.showReceipt({ isDraft: true });
  h.switchStore('12');
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  await h.window.invoiceModule.showReceipt({ isDraft: true });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  assert.match(h.document.getElementById('receiptPrintSettings').textContent, /width: 76mm/);
});

test('printer read failure or store switch during request never prints stale settings', async () => {
  const h = harness();
  await h.window.invoiceModule.showReceipt({ isDraft: true });
  h.window.api.get = async () => { throw new Error('offline'); };
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  h.window.api.get = async () => { h.switchStore('12'); return { settings: { paperSize: 'A4' } }; };
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  assert.equal(h.toasts.filter(t => t.type === 'error').length, 2);
});
