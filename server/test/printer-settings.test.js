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
  assert.match(h.document.getElementById('receiptPrintSettings').textContent, /width: 48mm/);
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
    ['K58', '58mm', '58mm 297mm'], ['K80', '80mm', '80mm 297mm'], ['K85', '85mm', '85mm 297mm'], ['A4', 'A4', 'A4']
  ]) {
    h.settings.set('11', { paperSize, autoPrintOnPayment: true });
    await button.click();
    assert.equal(h.document.getElementById('receiptPrintLabel').textContent, `In Hóa Đơn (${label})`);
    assert.ok(h.document.getElementById('receiptPrintSettings').textContent.includes(`size: ${page};`));
    assert.equal(h.prints(), ['K58', 'K80', 'K85', 'A4'].indexOf(paperSize));
    await h.document.getElementById('btnPrintReceiptBtn').click();
  }
  assert.equal(h.prints(), 4);
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
  assert.match(h.document.getElementById('receiptPrintSettings').textContent, /width: 72mm/);
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

test('paid reprint preserves Vietnamese, options, tax, notes and persisted payment data', async () => {
  const h = harness();
  h.window.appState.currentStore = { name: 'Gà Rán Ánh Dương', address: 'Đường Nguyễn Huệ', phone: '0901234567' };
  h.window.api.get = async url => url.startsWith('/orders/') ? {
    order: { id: 1, order_code: 'TG001', payment_status: 'PAID', subtotal: 45000, discount_amount: 5000,
      tax_amount: 2000, total_amount: 42000, cashier_name: 'Nguyễn Thị Ánh', note: 'Giao đúng giờ',
      order_type: 'TAKEAWAY', customer_name: 'Đỗ Thị Hồng', customer_phone: '0912345678', delivery_address: 'Số 5, Đường Lê Lợi' },
    items: [
      { product_name: 'Gà sốt <cay>', variant_name: 'Phần lớn', unit_price: 40000, quantity: 1, subtotal: 45000,
        options: [{ option_name: 'Phô mai', price: 5000 }], note: 'Ít ớt', status: 'READY' },
      { product_name: 'Món đã hủy', status: 'CANCELLED' }
    ],
    payments: [{ id: 1, status: 'FAILED', payment_method: 'CASH' }, { id: 2, status: 'SUCCESS', payment_method: 'QR' }]
  } : { settings: { paperSize: 'K58' } };
  await h.window.invoiceModule.showReceipt({ id: 1 });
  assert.equal(h.document.getElementById('receiptStorePhone').textContent, 'Hotline: 0901234567');
  assert.equal(h.document.getElementById('receiptMethod').textContent, 'VietQR');
  assert.equal(h.document.getElementById('receiptTax').textContent, '2000');
  assert.equal(h.document.getElementById('receiptCashRow').style.display, 'none');
  const html = h.document.getElementById('receiptItemsTbody').innerHTML;
  assert.match(html, /Gà sốt &lt;cay&gt;/);
  assert.match(html, /Ít ớt/);
  assert.match(html, /Đơn giá: 45000/);
  const text = h.window.invoiceModule.receiptText;
  for (const expected of ['GÀ RÁN ÁNH DƯƠNG', 'Đỗ Thị Hồng', 'Số 5, Đường Lê Lợi', 'Nguyễn Thị Ánh', 'Phô mai', 'Ít ớt', 'Thuế: 2000', 'TỔNG CỘNG: 42000', 'VietQR', 'Giao đúng giờ']) assert.ok(text.includes(expected), expected);
  assert.doesNotMatch(text, /Món đã hủy/);
});

test('cash reprint uses recorded tender/change and clears stale footer and contact details', async () => {
  const h = harness();
  h.document.getElementById('receiptStorePhone').textContent = 'old';
  h.document.getElementById('receiptFooterMessage').textContent = 'old';
  h.window.api.get = async url => url.startsWith('/orders/') ? {
    order: { id: 1, order_code: 'TG1', payment_status: 'PAID', total_amount: 40000 }, items: [],
    payments: [{ id: 5, status: 'SUCCESS', payment_method: 'CASH', cash_received: 50000, cash_return: 10000 }]
  } : { settings: { paperSize: 'K58' } };
  await h.window.invoiceModule.showReceipt({ id: 1 });
  assert.equal(h.document.getElementById('receiptCashGiven').textContent, '50000');
  assert.equal(h.document.getElementById('receiptCashReturn').textContent, '10000');
  assert.equal(h.document.getElementById('receiptStorePhone').textContent, '');
  assert.match(h.document.getElementById('receiptFooterMessage').textContent, /Cảm ơn/);
});

test('direct thermal printing requires updated Android bridge and rejects A4', async () => {
  const h = harness();
  h.settings.set('11', { paperSize: 'K58', connectionType: 'bluetooth' });
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'TEST' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  h.window.onesoftNativePrint = true;
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  assert.equal(h.window.appState.storeSettings.receipt_connection_type, 'bluetooth');
  h.settings.set('11', { paperSize: 'A4', connectionType: 'usb' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
});

test('test print uses the actual receipt and transport, includes Vietnamese accents', async () => {
  const h = harness();
  await h.window.moreMenuModule.openPrinterModal();
  h.document.getElementById('printerPaperSize').value = 'K58';
  h.document.getElementById('printerConnectionType').value = 'usb';
  h.window.onesoftNativePrint = true;
  await h.window.moreMenuModule.testPrintBill();
  assert.equal(h.prints(), 1);
  assert.match(h.window.invoiceModule.receiptText, /Ắ Ằ Ẳ Ẵ Ặ/);
  assert.match(h.window.invoiceModule.receiptText, /Thêm phô mai/);
  assert.match(h.window.invoiceModule.receiptText, /63000/);
});

test('failed settings save prevents test printing with stale connection', async () => {
  const h = harness();
  await h.window.moreMenuModule.openPrinterModal();
  h.window.api.put = async () => { throw new Error('offline'); };
  await h.window.moreMenuModule.testPrintBill();
  assert.equal(h.prints(), 0);
  assert.ok(h.toasts.some(toast => toast.message.includes('offline')));
});

test('draft table bill includes both previously sent and new food', async () => {
  const h = harness();
  Object.assign(h.window.appState, {
    cart: { orderType: 'DINE_IN', selectedTable: { code: 'B1' }, items: [{ product_name: 'Món thêm', quantity: 1, subtotal: 20000 }],
      sentItems: [{ product_name: 'Món cũ', quantity: 1, subtotal: 50000 }],
      sentOrder: { subtotal: 50000, discount_amount: 5000, tax_amount: 2000, total_amount: 47000 } },
    getCartSubtotal: () => 20000, getCartDiscount: () => 0, getCartGrandTotal: () => 20000
  });
  await h.window.invoiceModule.showDraftReceipt();
  assert.match(h.window.invoiceModule.receiptText, /Món cũ/);
  assert.match(h.window.invoiceModule.receiptText, /Món thêm/);
  assert.match(h.window.invoiceModule.receiptText, /TỔNG CỘNG: 67000/);
});

test('switching stores while fonts load prevents printing the previous receipt', async () => {
  const h = harness();
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'TEST' });
  h.document.fonts = { ready: { then(resolve) { h.switchStore('12'); resolve(); } } };
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  assert.ok(h.toasts.some(toast => toast.type === 'error'));
});

test('Android print waits for two frames with populated items and totals', async () => {
  const h = harness();
  let frames = 0;
  h.settings.set('11', { paperSize: 'K58', autoPrintOnPayment: true });
  h.window.requestAnimationFrame = callback => {
    assert.match(h.document.getElementById('receiptItemsTbody').innerHTML, /Gà rán/);
    assert.equal(h.document.getElementById('receiptTotal').textContent, '35000');
    assert.equal(h.prints(), 0);
    frames++;
    callback();
  };
  h.window.api.get = async url => url.startsWith('/orders/') ? {
    order: { id: 1, order_code: 'BILL', payment_status: 'PAID', total_amount: 35000, subtotal: 35000 },
    items: [{ product_name: 'Gà rán', quantity: 1, subtotal: 35000, unit_price: 35000 }]
  } : { settings: h.settings.get('11') };
  await h.window.invoiceModule.showReceipt({ id: 1 }, null, 0, { autoPrint: true });
  assert.equal(frames, 2);
  assert.equal(h.prints(), 1);
});

test('a receipt being loaded cannot print the previous bill', async () => {
  const h = harness();
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'OLD' });
  let finish;
  h.window.api.get = () => new Promise(resolve => { finish = resolve; });
  const loading = h.window.invoiceModule.showReceipt({ id: 2 });
  assert.equal(h.window.invoiceModule.currentOrder, null);
  assert.equal(h.document.getElementById('receiptModal').style.display, 'none');
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  // Finish with a fetch error so no printer-settings request remains pending.
  finish(null);
  await loading;
  assert.equal(h.prints(), 0);
});
