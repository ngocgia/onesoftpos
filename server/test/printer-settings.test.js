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
      post: async () => ({ configured: false }),
      showToast: (message, type) => toasts.push({ message, type }),
      formatMoney: value => String(value || 0)
    }
  };
  for (const file of ['more-menu.js', 'menu-persistence.js', 'invoice.js', 'orders.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js', file), 'utf8'), { window, document, console, URL, setTimeout, clearTimeout });
  }
  return { window, document, settings, toasts, prints: () => prints, switchStore: id => { storeId = id; } };
}

test('four printer profiles persist independently and kitchen slips use their own destination', async () => {
  const h = harness();
  await h.window.moreMenuModule.openPrinterModal();
  const menu = h.window.moreMenuModule;
  menu.editPrinter('kitchen');
  h.document.getElementById('printerEnabled-kitchen').checked = true;
  h.document.getElementById('printerkitchenConnectionType').value = 'lan';
  h.document.getElementById('printerkitchenIpAddress').value = '192.168.1.28';
  h.document.getElementById('printerIpAddress').value = '192.168.1.27';
  await menu.savePrinterSettings();
  const saved = h.settings.get('11');
  assert.deepEqual(Object.keys(saved.profiles), ['invoice', 'label', 'barcode', 'kitchen']);
  assert.equal(saved.profiles.invoice.ipAddress, '192.168.1.27');
  assert.equal(saved.profiles.kitchen.ipAddress, '192.168.1.28');
  assert.equal(saved.profiles.label.configured, false);
  assert.equal((await h.window.invoiceModule.loadPrinterSettings('11', 'kitchen')).connectionType, 'lan');
  assert.equal((await h.window.invoiceModule.loadPrinterSettings('11', 'invoice')).connectionType, 'browser');
  const { validate } = require('../src/controllers/menuPreferencesController');
  assert.equal(validate('printer', saved).profiles.kitchen.ipAddress, '192.168.1.28');
  await menu.openPrinterModal();
  menu.removePrinter('kitchen');
  await menu.savePrinterSettings();
  assert.equal((await h.window.invoiceModule.loadPrinterSettings('11', 'kitchen')).enabled, false);
  assert.equal(h.settings.get('11').profiles.invoice.configured, true);
});

test('disabled invoice profile blocks printing and enabled empty profiles cannot be saved', async () => {
  const h = harness();
  await h.window.moreMenuModule.openPrinterModal();
  h.document.getElementById('printerEnabled-invoice').checked = false;
  await h.window.moreMenuModule.savePrinterSettings();
  await h.window.invoiceModule.showReceipt({ isDraft: true, items: [] });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  h.document.getElementById('printerEnabled-label').checked = true;
  assert.throws(() => h.window.moreMenuModule.getPrinterSettingsFromForm(), /thêm máy in/);
});

test('printer profile validation rejects malformed groups and preserves legacy payloads', () => {
  const h = harness();
  const menu = h.window.moreMenuModule;
  const { validate } = require('../src/controllers/menuPreferencesController');
  const legacy = { paperSize: 'K80', connectionType: 'browser', ipAddress: '', autoPrintOnPayment: true,
    autoPrintOrderSlipOnTransfer: false, autoCutPaper: true, printKitchenSeparate: false };
  const profiles = menu.normalizePrinterProfiles(legacy);
  assert.doesNotThrow(() => validate('printer', { ...legacy, profiles }));
  assert.throws(() => validate('printer', { ...legacy, profiles: { invoice: profiles.invoice } }));
  profiles.label.enabled = true;
  assert.throws(() => validate('printer', { ...legacy, profiles }));
  profiles.label.configured = true;
  profiles.label.connectionType = 'invalid';
  assert.throws(() => validate('printer', { ...legacy, profiles }));
});

test('saved printer settings apply to draft, reprint and subsequent changes from another cashier', async () => {
  const h = harness();
  await h.window.moreMenuModule.openPrinterModal();
  h.document.getElementById('printerPaperSize').value = 'K58';
  h.document.getElementById('printerConnectionType').value = 'browser';
  h.document.getElementById('printerAutoPrint').checked = false;
  h.document.getElementById('printerAutoPrintOrderSlip').checked = true;
  await h.window.moreMenuModule.savePrinterSettings();
  assert.equal(h.settings.get('11').paperSize, 'K58');
  assert.equal(h.settings.get('11').autoPrintOrderSlipOnTransfer, true);
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
  assert.match(html, /<td class="text-right">45000<\/td>/);
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

test('USB direct printing cannot silently use a browser driver and accepts all thermal sizes on Android', async () => {
  const h = harness();
  h.settings.set('11', { paperSize: 'K80', connectionType: 'usb' });
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'USB' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  assert.match(h.toasts.at(-1).message, /Trên web, chọn Trình duyệt/);
  h.window.onesoftNativePrint = true;
  h.window.onesoftNativeReceiptQr = true;
  for (const paperSize of ['K58', 'K80', 'K85']) {
    h.settings.set('11', { paperSize, connectionType: 'usb' });
    await h.window.invoiceModule.printReceipt();
  }
  assert.equal(h.prints(), 3);
  h.settings.set('11', { paperSize: 'A4', connectionType: 'usb' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 3);
});

test('Bluetooth printing preserves thermal sizes, QR and cutter preferences and rejects unsupported A4', async () => {
  const h = harness();
  h.window.onesoftNativePrint = true;
  h.window.onesoftNativeReceiptQr = true;
  h.settings.set('11', { paperSize: 'K58', connectionType: 'bluetooth', autoCutPaper: false });
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'BLUETOOTH' });
  h.window.invoiceModule.receiptQrUrl = 'https://img.vietqr.io/image/test.png';
  for (const paperSize of ['K58', 'K80', 'K85']) {
    h.settings.set('11', { paperSize, connectionType: 'bluetooth', autoCutPaper: false });
    await h.window.invoiceModule.printReceipt();
    assert.equal(h.window.appState.storeSettings.receipt_connection_type, 'bluetooth');
    assert.equal(h.window.appState.storeSettings.receipt_auto_cut_paper, false);
    assert.equal(h.window.invoiceModule.receiptQrUrl, 'https://img.vietqr.io/image/test.png');
  }
  assert.equal(h.prints(), 3);
  h.settings.set('11', { paperSize: 'A4', connectionType: 'bluetooth' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 3);
  assert.match(h.toasts.at(-1).message, /K58, K80 hoặc K85/);
});

test('RawBT never silently falls back on older APKs, supports receipts with QR and rejects A4', async () => {
  const h = harness();
  h.settings.set('11', { paperSize: 'K80', connectionType: 'rawbt' });
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'RAWBT' });
  h.window.onesoftNativePrint = true;
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  assert.match(h.toasts.at(-1).message, /cập nhật APK/);
  h.window.onesoftNativeRawBt = true;
  h.window.invoiceModule.receiptQrUrl = 'https://img.vietqr.io/image/test.png';
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  assert.equal(h.window.appState.storeSettings.receipt_connection_type, 'rawbt');
  h.settings.set('11', { paperSize: 'A4', connectionType: 'rawbt' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  assert.match(h.toasts.at(-1).message, /K58, K80 hoặc K85/);
});

test('automatic cutter setting reaches the Android bridge and follows the latest saved preference', async () => {
  const h = harness();
  h.window.onesoftNativePrint = true;
  h.window.onesoftNativeRawBt = true;
  h.settings.set('11', { paperSize: 'K80', connectionType: 'rawbt', autoCutPaper: true });
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'CUT' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.window.appState.storeSettings.receipt_auto_cut_paper, true);
  h.settings.set('11', { paperSize: 'K80', connectionType: 'rawbt', autoCutPaper: false });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.window.appState.storeSettings.receipt_auto_cut_paper, false);
  assert.equal(h.prints(), 2);
});

test('LAN printing forwards IP and blocks browser/old APK fallback, invalid addresses and A4', async () => {
  const h = harness();
  h.settings.set('11', { paperSize: 'K80', connectionType: 'lan', ipAddress: '192.168.1.27', autoCutPaper: true });
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'LAN' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  assert.match(h.toasts.at(-1).message, /1.3.7/);
  h.window.onesoftNativePrint = true;
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  h.window.onesoftNativeLanPrint = true;
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  assert.equal(h.window.appState.storeSettings.receipt_ip_address, '192.168.1.27');
  assert.equal(h.window.appState.storeSettings.receipt_auto_cut_paper, true);
  for (const ipAddress of ['', 'http://192.168.1.27', '192.168.1.999', '192.168.1.27:9100', '224.0.0.1']) {
    h.settings.set('11', { paperSize: 'K80', connectionType: 'lan', ipAddress });
    await h.window.invoiceModule.printReceipt();
    assert.equal(h.prints(), 1);
    assert.match(h.toasts.at(-1).message, /IP máy in hợp lệ/);
  }
  h.settings.set('11', { paperSize: 'A4', connectionType: 'lan', ipAddress: '192.168.1.27' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  h.settings.set('11', { paperSize: 'K80', connectionType: 'network', ipAddress: '192.168.1.28' });
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 2);
  assert.equal(h.window.appState.storeSettings.receipt_ip_address, '192.168.1.28');
});

test('Android bridge includes IP, LAN capability and cutter flag in its print request', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../android-pos/app/src/main/java/vn/pro/giavdn/onesoftpos/MainActivity.java'), 'utf8');
  const region = source.split('private static final String APP_BRIDGE_SCRIPT =')[1].split('private WebView')[0];
  const script = [...region.matchAll(/"(?:\\.|[^"\\])*"/g)].map(match => JSON.parse(match[0])).join('');
  const window = { appState: { storeSettings: { receipt_paper_size: '80mm', receipt_connection_type: 'lan', receipt_ip_address: '192.168.1.27', receipt_auto_cut_paper: false } }, location: {} };
  vm.runInNewContext(script, { window });
  window.print();
  const url = new URL(window.location.href);
  assert.equal(window.onesoftNativeLanPrint, true);
  assert.equal(url.searchParams.get('ip'), '192.168.1.27');
  assert.equal(url.searchParams.get('connection'), 'lan');
  assert.equal(url.searchParams.get('cut'), '0');
});

test('Android freezes receipt layout synchronously before order-slip content can be restored', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../android-pos/app/src/main/java/vn/pro/giavdn/onesoftpos/MainActivity.java'), 'utf8');
  const region = source.split('private static final String APP_BRIDGE_SCRIPT =')[1].split('private WebView')[0];
  const script = [...region.matchAll(/"(?:\\.|[^"\\])*"/g)].map(match => JSON.parse(match[0])).join('');
  let content = 'PHIẾU ĐẶT ĐỒ';
  const window = { appState: { storeSettings: {} }, location: {}, onesoftBuildReceiptSnapshot: () => ({ html: '<table>' + content + '</table>', text: content, storeId: '11' }) };
  vm.runInNewContext(script, { window });
  window.print();
  content = 'HÓA ĐƠN CŨ';
  assert.equal(window.onesoftPendingReceipt.text, 'PHIẾU ĐẶT ĐỒ');
  assert.equal(window.onesoftPendingReceipt.html, '<table>PHIẾU ĐẶT ĐỒ</table>');
});

test('RawBT configuration persists through the printer settings API', () => {
  const { validate } = require('../src/controllers/menuPreferencesController');
  const settings = { paperSize: 'K80', connectionType: 'rawbt', ipAddress: '', autoPrintOnPayment: false, autoCutPaper: false, printKitchenSeparate: false };
  assert.equal(validate('printer', settings).connectionType, 'rawbt');
});

test('Android LAN compatibility reads saved printer IP when the older website omitted the bridge field', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../android-pos/app/src/main/java/vn/pro/giavdn/onesoftpos/MainActivity.java'), 'utf8');
  const literal = source.match(/view\.evaluateJavascript\(("\(function\(\)\{var saved=(?:\\.|[^"\\])*"), value ->/)[1];
  const script = JSON.parse(literal);
  const window = {
    invoiceModule: { receiptText: 'Hóa đơn LAN' },
    appState: { storeSettings: {} },
    menuPersistence: { read(section) { assert.equal(section, 'printer'); return { ipAddress: '192.168.1.27' }; } }
  };
  assert.equal(vm.runInNewContext(script, { window }).ip, '192.168.1.27');
  window.menuPersistence.read = () => ({}); // Another store has no saved printer.
  assert.equal(vm.runInNewContext(script, { window }).ip, '');
  delete window.menuPersistence;
  assert.equal(vm.runInNewContext(script, { window }).ip, '');
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
  assert.match(h.window.invoiceModule.receiptText, /TỔNG TẠM TÍNH: 67000/);
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

test('order slip matches food-only layout and restores invoice content afterward', async () => {
  const h = harness();
  h.settings.set('11', { paperSize: 'K58', autoPrintOnPayment: false });
  const invoice = h.window.invoiceModule;
  await invoice.showOrderSlip({ id: 127, order_code: 'HD.000127', table_name: 'Bàn 04', note: 'Làm trước' }, [
    { product_name: 'Bánh ép <cay>', variant_name: '1 Phần/2c', quantity: 2, unit: 'Phần', note: 'Ít ớt', options: [{ name: 'Trứng' }] },
    { product_name: 'Món hủy', quantity: 1, status: 'CANCELLED' }
  ]);
  assert.equal(h.prints(), 1);
  const html = h.document.getElementById('orderSlipContent').innerHTML;
  for (const expected of ['PHIẾU ĐẶT ĐỒ', 'Bàn 04', 'HD.000127', 'SL: 2', '<th>ĐVT</th>', 'Bánh ép &lt;cay&gt;', '1 Phần/2c', 'Ít ớt', 'Trứng', 'Phần']) assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(html, /Món hủy|TỔNG CỘNG|Đơn giá|Thanh toán/);
  assert.match(invoice.receiptText, /PHIẾU ĐẶT ĐỒ/);
  assert.match(h.document.getElementById('receiptPrintSettings').textContent, /width: 48mm/);
  assert.equal(h.document.getElementById('receiptInvoiceContent').style.display, 'none');
  assert.match(h.document.getElementById('receiptPrintLabel').textContent, /phiếu đặt đồ/);
  await invoice.showReceipt({ isDraft: true, items: [] });
  assert.equal(h.document.getElementById('receiptInvoiceContent').style.display, 'block');
  assert.equal(h.document.getElementById('orderSlipContent').style.display, 'none');
  assert.match(h.document.getElementById('receiptPrintLabel').textContent, /Hóa Đơn/);
});

test('order slip auto printing is opt-in and independent from payment printing', async () => {
  const h = harness();
  const invoice = h.window.invoiceModule;
  const items = [{ product_name: 'Gà', quantity: 1 }];
  h.settings.set('11', { autoPrintOnPayment: true });
  await invoice.showOrderSlip({ id: 1 }, items, { auto: true });
  assert.equal(h.prints(), 0);
  assert.equal(invoice.currentOrder, null);
  h.settings.set('11', { autoPrintOrderSlipOnTransfer: true, autoPrintOnPayment: false });
  await invoice.showOrderSlip({ id: 1 }, items, { auto: true });
  assert.equal(h.prints(), 1);
  h.settings.set('11', { autoPrintOrderSlipOnTransfer: false });
  await invoice.showOrderSlip({ id: 1 }, items);
  assert.equal(h.prints(), 2);
});

test('manual order slip uses new food, or sent food when cart has no new items', async () => {
  const h = harness();
  const invoice = h.window.invoiceModule;
  h.window.appState.cart = {
    orderType: 'DINE_IN', selectedTable: { name: 'Bàn 04' }, sentOrder: { id: 1, order_code: 'HD01' },
    sentItems: [{ product_name: 'Món cũ', quantity: 2 }], items: [{ product_name: 'Món mới', quantity: 1 }]
  };
  await invoice.printCartOrderSlip();
  assert.match(invoice.receiptText, /Món mới/);
  assert.doesNotMatch(invoice.receiptText, /Món cũ/);
  h.window.appState.cart.items = [];
  await invoice.printCartOrderSlip();
  assert.match(invoice.receiptText, /Món cũ/);
  assert.equal(h.prints(), 2);
});

test('order slip cannot print after store changes or settings fail to load', async () => {
  const h = harness();
  const invoice = h.window.invoiceModule;
  const items = [{ product_name: 'Gà', quantity: 1 }];
  await invoice.showOrderSlip({ id: 1 }, items, { storeId: '12' });
  h.window.api.get = async () => { throw new Error('offline'); };
  await invoice.showOrderSlip({ id: 1 }, items);
  assert.equal(h.prints(), 0);
  assert.equal(h.toasts.filter(toast => toast.type === 'error').length, 2);
});

test('unpaid bill QR uses full total without creating an order and waits for its image', async () => {
  const h = harness();
  const calls = [];
  let decoded = false;
  h.document.getElementById('receiptQrImage').decode = async () => { decoded = true; };
  h.window.api.post = async (url, body) => {
    calls.push({ url, body });
    return { configured: true, qrUrl: 'https://img.vietqr.io/image/970422-0123456789-qr_only.png?amount=50000',
      bankName: 'MB Bank', bankAccount: '0123456789', accountHolder: 'NGUYEN VAN A', memo: body.memo };
  };
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'TAM-01', total_amount: 50000, items: [] });
  assert.equal(decoded, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/payments/vietqr/receipt');
  assert.equal(calls[0].body.amount, 50000);
  assert.equal(calls[0].body.memo, 'TAM-01');
  assert.equal(h.document.getElementById('receiptPaymentQr').style.display, 'block');
  assert.match(h.window.invoiceModule.receiptQrUrl, /amount=50000/);
  assert.equal(h.document.getElementById('receiptTotalLabel').textContent, 'TỔNG TẠM TÍNH');
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  assert.equal(h.document.getElementById('receiptPrintCount').textContent, 'In lần 1');
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.document.getElementById('receiptPrintCount').textContent, 'In lần 2');
});

test('paid receipts include payment QR while kitchen slips clear it', async () => {
  const h = harness();
  h.window.invoiceModule.receiptQrUrl = 'https://img.vietqr.io/old.png';
  h.document.getElementById('receiptPaymentQr').style.display = 'block';
  h.window.api.get = async url => url.startsWith('/orders/')
    ? { order: { id: 1, order_code: 'HD01', total_amount: 50000, payment_status: 'PAID' }, items: [] }
    : { settings: {} };
  h.window.api.post = async () => ({ configured: true, qrUrl: 'https://img.vietqr.io/image/paid.png', bankName: 'MB Bank', bankAccount: '0123456789', accountHolder: 'TEST', memo: 'HD01' });
  await h.window.invoiceModule.showReceipt({ id: 1 });
  assert.equal(h.window.invoiceModule.receiptQrUrl, 'https://img.vietqr.io/image/paid.png');
  assert.equal(h.document.getElementById('receiptPaymentQr').style.display, 'block');
  await h.window.invoiceModule.showOrderSlip({ id: 1 }, [{ product_name: 'Gà', quantity: 1 }]);
  assert.equal(h.window.invoiceModule.receiptQrUrl, '');
});

test('QR image failures do not block the bill or print a stale QR', async () => {
  const h = harness();
  h.window.api.post = async () => ({ configured: true, qrUrl: 'https://img.vietqr.io/image/test.png' });
  h.document.getElementById('receiptQrImage').decode = async () => { throw new Error('offline'); };
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'TAM1', total_amount: 50000 });
  assert.equal(h.window.invoiceModule.receiptQrUrl, '');
  assert.equal(h.document.getElementById('receiptPaymentQr').style.display, 'none');
  assert.equal(h.document.getElementById('receiptQrNotice').style.display, 'block');
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
});

test('a slow older QR response cannot overwrite a newer receipt', async () => {
  const h = harness();
  let finish;
  let started;
  const qrStarted = new Promise(resolve => { started = resolve; });
  h.window.api.post = () => new Promise(resolve => { finish = resolve; started(); });
  const loading = h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'OLD', total_amount: 10000 });
  await qrStarted;
  await h.window.invoiceModule.showReceipt({ isDraft: true, order_code: 'NEW', total_amount: 0 });
  finish({ configured: true, qrUrl: 'https://img.vietqr.io/old.png' });
  await loading;
  assert.equal(h.window.invoiceModule.currentOrder.order_code, 'NEW');
  assert.equal(h.window.invoiceModule.receiptQrUrl, '');
  assert.equal(h.document.getElementById('receiptPaymentQr').style.display, 'none');
});

test('direct QR printing requires the Android QR bridge', async () => {
  const h = harness();
  h.settings.set('11', { paperSize: 'K58', connectionType: 'bluetooth' });
  await h.window.invoiceModule.showReceipt({ isDraft: true, items: [] });
  h.window.invoiceModule.receiptQrUrl = 'https://img.vietqr.io/image/test.png';
  h.window.onesoftNativePrint = true;
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 0);
  assert.match(h.toasts.at(-1).message, /cập nhật ứng dụng Android/);
  h.window.onesoftNativeReceiptQr = true;
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
});

for (const paymentMethod of ['CASH', 'BANK_TRANSFER', 'CARD', 'QR']) {
  test(`completed ${paymentMethod} payment prints a receipt with QR even when automatic printing was disabled`, async () => {
    const h = harness();
    h.settings.set('11', { paperSize: 'K58', autoPrintOnPayment: false });
    let qrRequests = 0;
    h.window.api.get = async url => url.startsWith('/orders/')
      ? { order: { id: 1, order_code: 'HD01', total_amount: 50000, payment_status: 'PAID' }, items: [] }
      : { settings: h.settings.get('11') };
    h.window.api.post = async (url, body) => {
      assert.equal(url, '/payments/vietqr/receipt');
      assert.equal(body.amount, 50000);
      assert.equal(body.memo, 'HD01');
      qrRequests++;
      return { configured: true, qrUrl: 'https://img.vietqr.io/image/970422-0123456789-qr_only.png?amount=50000',
        bankName: 'MB Bank', bankAccount: '0123456789', accountHolder: 'TEST', memo: 'HD01' };
    };
    await h.window.invoiceModule.showReceipt({ id: 1 }, { payment_method: paymentMethod, cash_received: 50000 }, 0, { autoPrint: true, forcePrint: true });
    assert.equal(qrRequests, 1);
    assert.equal(h.prints(), 1);
    assert.equal(h.document.getElementById('receiptPaymentQr').style.display, 'block');
    assert.match(h.window.invoiceModule.receiptQrUrl, /amount=50000/);
    assert.equal(h.toasts.filter(toast => toast.type === 'error').length, 0);
  });
}


test('invoice content switches save and restore separately from printer destinations', async () => {
  const h = harness();
  const menu = h.window.moreMenuModule;
  await menu.openPrinterModal();
  for (const key of Object.keys(menu.defaultInvoiceOptions)) {
    assert.equal(h.document.getElementById('invoiceOption-' + key).checked, true);
    h.document.getElementById('invoiceOption-' + key).checked = false;
  }
  await menu.savePrinterSettings();
  const saved = h.settings.get('11');
  const { validate } = require('../src/controllers/menuPreferencesController');
  assert.equal(Object.values(validate('printer', saved).invoiceOptions).every(value => value === false), true);
  assert.throws(() => validate('printer', { ...saved, invoiceOptions: { ...saved.invoiceOptions, qr: 'false' } }));
  assert.throws(() => validate('printer', { ...saved, invoiceOptions: { ...saved.invoiceOptions, extra: true } }));
  await menu.openPrinterModal();
  for (const key of Object.keys(menu.defaultInvoiceOptions)) assert.equal(h.document.getElementById('invoiceOption-' + key).checked, false);
});

for (const [key, id, text] of [
  ['notes', 'receiptNote', 'Ghi chú đơn:'], ['tax', 'receiptTaxRow', 'Thuế:'],
  ['checkIn', 'receiptDateTime', 'Giờ vào:'], ['checkOut', 'receiptExitTime', 'Giờ ra:'],
  ['staff', 'receiptCashier', 'Nhân viên:'], ['qr', 'receiptPaymentQr', 'Quét mã QR'],
  ['printCount', 'receiptPrintCount', 'In lần'], ['orderCode', 'receiptOrderCodeText', 'Mã đơn:']
]) {
  test('invoice option ' + key + ' applies to preview, refreshed reprints and native text', async () => {
    const h = harness();
    let qrCalls = 0;
    const get = h.window.api.get;
    h.window.api.get = async url => url.startsWith('/orders/') ? {
      order: { id: 1, order_code: 'HD01', payment_status: 'PAID', created_at: '2026-10-25T03:00:00Z',
        completed_at: '2026-10-25T04:00:00Z', cashier_name: 'Nguyễn An', note: 'Ghi chú đơn riêng',
        subtotal: 50000, tax_amount: 5000, total_amount: 55000 },
      items: [{ product_name: 'Gà', quantity: 1, subtotal: 50000, note: 'Ghi chú món riêng' }]
    } : get(url);
    h.window.api.post = async () => {
      qrCalls++;
      return { configured: true, qrUrl: 'https://img.vietqr.io/image/test.png' };
    };
    const options = { ...h.window.moreMenuModule.defaultInvoiceOptions, [key]: false };
    h.settings.set('11', { invoiceOptions: options });
    const invoice = h.window.invoiceModule;
    await invoice.showReceipt({ id: 1 });
    assert.equal(h.document.getElementById(id).style.display, 'none');
    assert.equal(invoice.receiptText.includes(text), false);
    assert.equal(h.document.getElementById('receiptTotal').textContent, '55000');
    if (key === 'notes') assert.doesNotMatch(h.document.getElementById('receiptItemsTbody').innerHTML, /Ghi chú món riêng/);
    if (key === 'qr') { assert.equal(qrCalls, 0); assert.equal(invoice.receiptQrUrl, ''); }
    h.settings.set('11', { invoiceOptions: { ...options, [key]: true } });
    await invoice.printReceipt();
    assert.notEqual(h.document.getElementById(id).style.display, 'none');
    assert.equal(invoice.receiptText.includes(text), true);
    h.settings.set('11', { invoiceOptions: options });
    await invoice.printReceipt();
    assert.equal(h.document.getElementById(id).style.display, 'none');
    assert.equal(invoice.receiptText.includes(text), false);
    assert.equal(h.prints(), 2);
    if (key === 'printCount') assert.equal(h.document.getElementById('receiptPrintCount').textContent, 'In lần 2');
    if (key === 'qr') assert.equal(invoice.receiptQrUrl, '');
  });
}

test('six-option invoice settings remain valid and default new switches to on', () => {
  const { validate } = require('../src/controllers/menuPreferencesController');
  const settings = { paperSize: 'K80', connectionType: 'browser', ipAddress: '', autoPrintOnPayment: false,
    autoCutPaper: false, printKitchenSeparate: false,
    invoiceOptions: { qr: false, notes: true, tax: false, checkIn: true, checkOut: false, staff: true } };
  const options = validate('printer', settings).invoiceOptions;
  assert.equal(options.printCount, true);
  assert.equal(options.orderCode, true);
  assert.equal(options.qr, false);
});

test('unpaid invoices have no checkout time and invoice options do not hide kitchen notes', async () => {
  const h = harness();
  const invoice = h.window.invoiceModule;
  h.settings.set('11', { invoiceOptions: Object.fromEntries(Object.keys(h.window.moreMenuModule.defaultInvoiceOptions).map(key => [key, false])) });
  await invoice.showReceipt({ isDraft: true, items: [] });
  assert.equal(h.document.getElementById('receiptExitTime').textContent, '');
  await invoice.showOrderSlip({ id: 1, note: 'Ghi chú bếp' }, [{ product_name: 'Gà', quantity: 1, note: 'Ít cay' }]);
  assert.match(invoice.receiptText, /Ít cay/);
  assert.match(invoice.receiptText, /Ghi chú bếp/);
});


const uploadedQrPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';

test('uploaded QR image saves per store, restores preview, and can be removed', async () => {
  const h = harness();
  const menu = h.window.moreMenuModule;
  await menu.openPrinterModal();
  h.document.getElementById('paymentQrSource').value = 'upload';
  menu.updatePaymentQrEditor();
  assert.throws(() => menu.getPrinterSettingsFromForm(), /tải ảnh QR/);
  menu.paymentQrDraft.image = uploadedQrPng;
  menu.updatePaymentQrEditor();
  await menu.savePrinterSettings();
  const { validate } = require('../src/controllers/menuPreferencesController');
  assert.equal(validate('printer', h.settings.get('11')).paymentQr.image, uploadedQrPng);
  await menu.openPrinterModal();
  assert.equal(h.document.getElementById('paymentQrPreview').src, uploadedQrPng);
  assert.equal(h.document.getElementById('paymentQrUpload').hidden, false);
  menu.removePaymentQrImage();
  assert.equal(h.document.getElementById('paymentQrPreview').hidden, true);
  h.switchStore('12');
  await menu.openPrinterModal();
  assert.equal(menu.paymentQrDraft.image, '');
  assert.equal(menu.paymentQrDraft.source, 'vietqr');
});

test('uploaded QR prints without bank configuration, refreshes changed images and respects QR off', async () => {
  const h = harness();
  let requests = 0;
  h.window.api.post = async () => { requests++; return { configured: true, qrUrl: 'https://img.vietqr.io/image/current.png', bankName: 'MB', accountHolder: 'TEST', bankAccount: '123', memo: 'TEST' }; };
  const config = { paymentQr: { source: 'upload', image: uploadedQrPng } };
  h.settings.set('11', config);
  const invoice = h.window.invoiceModule;
  let decoded = 0;
  h.document.getElementById('receiptQrImage').decode = async () => { decoded++; };
  h.document.getElementById('receiptQrMemo').textContent = 'Nội dung cũ';
  await invoice.showReceipt({ isDraft: true, total_amount: 50000, items: [] });
  assert.equal(invoice.receiptQrUrl, uploadedQrPng);
  assert.equal(requests, 0);
  assert.equal(decoded, 1);
  assert.equal(h.document.getElementById('receiptQrMemo').textContent, '');
  await invoice.printReceipt();
  assert.equal(h.prints(), 1);
  const replacement = 'data:image/jpeg;base64,/9j/AA==';
  h.settings.set('11', { paymentQr: { source: 'upload', image: replacement } });
  await invoice.printReceipt();
  assert.equal(invoice.receiptQrUrl, replacement);
  h.settings.set('11', { paymentQr: { source: 'vietqr', image: '' } });
  await invoice.printReceipt();
  assert.equal(invoice.receiptQrUrl, 'https://img.vietqr.io/image/current.png');
  assert.equal(requests, 1);
  h.settings.set('11', { ...config, invoiceOptions: { qr: false } });
  await invoice.printReceipt();
  assert.equal(invoice.receiptQrUrl, '');
  assert.equal(h.document.getElementById('receiptPaymentQr').style.display, 'none');
});

test('QR upload processes a real file selection and discards results after a store switch', async () => {
  const h = harness();
  const menu = h.window.moreMenuModule;
  await menu.openPrinterModal();
  h.document.getElementById('paymentQrSource').value = 'upload';
  menu.updatePaymentQrEditor();
  let reader;
  h.window.FileReader = class { readAsDataURL() { reader = this; } };
  h.window.Image = class { constructor() { this.width = 400; this.height = 400; } set src(value) { this.onload(); } };
  h.document.createElement = () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => uploadedQrPng });
  const event = { target: { files: [{ type: 'image/png', size: 1000 }] } };
  const pending = menu.uploadPaymentQr(event);
  assert.throws(() => menu.getPrinterSettingsFromForm(), /đang được xử lý/);
  reader.result = uploadedQrPng; reader.onload();
  await pending;
  assert.equal(menu.paymentQrDraft.image, uploadedQrPng);
  menu.removePaymentQrImage();
  const stale = menu.uploadPaymentQr(event);
  h.switchStore('12');
  reader.result = uploadedQrPng; reader.onload();
  await stale;
  assert.equal(menu.paymentQrDraft.image, '');
});

test('QR configuration rejects external images, malformed data, wrong formats and excessive size', () => {
  const { validate } = require('../src/controllers/menuPreferencesController');
  const legacy = { paperSize: 'K80', connectionType: 'browser', ipAddress: '', autoPrintOnPayment: false, autoCutPaper: false, printKitchenSeparate: false };
  for (const image of ['https://example.com/qr.png', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,AAAA', uploadedQrPng + 'A'.repeat(2 * 1024 * 1024)]) {
    assert.throws(() => validate('printer', { ...legacy, paymentQr: { source: 'upload', image } }));
  }
  assert.throws(() => validate('printer', { ...legacy, paymentQr: { source: 'upload', image: '' } }));
  assert.doesNotThrow(() => validate('printer', { ...legacy, paymentQr: { source: 'upload', image: uploadedQrPng } }));
});

test('broken uploaded QR never falls back to a previous QR or blocks the invoice', async () => {
  const h = harness();
  h.settings.set('11', { paymentQr: { source: 'upload', image: uploadedQrPng } });
  h.document.getElementById('receiptQrImage').decode = async () => { throw new Error('broken'); };
  await h.window.invoiceModule.showReceipt({ isDraft: true, total_amount: 50000, items: [] });
  assert.equal(h.window.invoiceModule.receiptQrUrl, '');
  assert.equal(h.document.getElementById('receiptPaymentQr').style.display, 'none');
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
});


test('86KB QR uploads survive selection, validation, save and invoice rendering without re-encoding', async () => {
  const h = harness();
  const menu = h.window.moreMenuModule;
  await menu.openPrinterModal();
  h.document.getElementById('paymentQrSource').value = 'upload';
  menu.updatePaymentQrEditor();
  // The image decoder is mocked; retain a PNG signature for server validation.
  const bytes = Buffer.alloc(86 * 1024);
  Buffer.from(uploadedQrPng.split(',')[1], 'base64').copy(bytes);
  const source = 'data:image/png;base64,' + bytes.toString('base64');
  h.window.FileReader = class { readAsDataURL() { this.result = source; this.onload(); } };
  h.window.Image = class { constructor() { this.width = 600; this.height = 600; } set src(value) { this.onload(); } };
  h.document.createElement = () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => { throw new Error('Small image must stay intact'); } });
  await menu.uploadPaymentQr({ target: { files: [{ type: 'image/png', size: bytes.length }] } });
  assert.equal(menu.paymentQrDraft.image, source);
  assert.equal(h.toasts.some(entry => entry.type === 'error'), false);
  const { validate } = require('../src/controllers/menuPreferencesController');
  h.window.api.put = async (url, body) => {
    const saved = validate('printer', body);
    h.settings.set('11', saved);
    return { settings: saved };
  };
  await menu.savePrinterSettings();
  assert.equal(h.settings.get('11').paymentQr.image, source);
  await h.window.invoiceModule.showReceipt({ isDraft: true, total_amount: 10000, items: [] });
  assert.equal(h.window.invoiceModule.receiptQrUrl, source);
  await h.window.invoiceModule.printReceipt();
  assert.equal(h.prints(), 1);
  assert.equal(h.toasts.some(entry => entry.type === 'error'), false);
});

test('large QR uploads resize and use JPEG only when the PNG exceeds the storage limit', async () => {
  const h = harness();
  const menu = h.window.moreMenuModule;
  await menu.openPrinterModal();
  h.document.getElementById('paymentQrSource').value = 'upload';
  menu.updatePaymentQrEditor();
  const oversized = 'data:image/png;base64,' + 'A'.repeat(menu.maxPaymentQrImageLength);
  h.window.FileReader = class { readAsDataURL() { this.result = oversized; this.onload(); } };
  h.window.Image = class { constructor() { this.width = 3000; this.height = 2000; } set src(value) { this.onload(); } };
  const formats = [];
  const canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: format => {
    formats.push(format);
    return format === 'image/png' ? oversized : uploadedQrPng;
  } };
  h.document.createElement = () => canvas;
  await menu.uploadPaymentQr({ target: { files: [{ type: 'image/png', size: 3 * 1024 * 1024 }] } });
  assert.equal(canvas.width, 960);
  assert.equal(canvas.height, 640);
  assert.deepEqual(formats, ['image/png', 'image/jpeg']);
  assert.equal(menu.paymentQrDraft.image, uploadedQrPng);
  assert.equal(h.toasts.some(entry => entry.type === 'error'), false);
});
