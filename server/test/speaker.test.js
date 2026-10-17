const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness() {
  const calls = [], toasts = [];
  let store = '11';
  const settings = { enableNewOrderSound: true, enableKitchenDoneSound: true, enableVietQRSpeech: true, volume: 37 };
  const window = {
    api: { getCurrentStoreId: () => store, showToast: (...args) => toasts.push(args) },
    menuPersistence: { read: () => settings },
    onesoftAudio: { beep: volume => calls.push({ kind: 'beep', volume }), speak: (text, volume) => calls.push({ kind: 'speak', text, volume }) }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/audio.js'), 'utf8'), { window, console });
  return { audio: window.audioModule, window, calls, settings, toasts, store: value => { store = value; } };
}
const orders = (...ids) => [{ order_type: 'DINE_IN', table_code: 'B03', items: ids.map(id => ({ id, product_name: 'Gà sốt phô mai' })) }];

test('Android beep and Vietnamese speech use native audio without WebView speech APIs', async () => {
  const h = harness();
  await h.audio.beep();
  h.audio.speak('Món gà bàn B03 đã xong');
  assert.equal(h.calls[0].volume, 37);
  assert.equal(h.calls[0].kind, 'beep');
  assert.equal(h.calls[1].text, 'Món gà bàn B03 đã xong');
  assert.equal(h.calls[1].volume, 37);
  assert.equal(h.toasts.length, 0);
});

test('speaker respects disabled categories and zero volume, including sample playback', async () => {
  const h = harness();
  Object.assign(h.settings, { enableNewOrderSound: false, enableKitchenDoneSound: false, enableVietQRSpeech: false });
  await h.audio.beep(); h.audio.speak('xong'); h.audio.speak('VietQR', { kind: 'qr' });
  assert.equal(h.calls.length, 0);
  await h.audio.beep({ force: true, volume: 0 });
  h.audio.speak('mẫu', { force: true, volume: 0 });
  assert.equal(h.calls.length, 0);
  h.audio.speak('mẫu', { force: true, volume: 22 });
  assert.equal(h.calls[0].volume, 22);
});

test('polling baseline is silent, new items alert once, changing filters does not repeat them', () => {
  const h = harness();
  h.audio.observeItems('new', orders(1));
  assert.equal(h.calls.length, 0);
  h.audio.observeItems('new', orders(1, 2));
  assert.equal(h.calls.length, 1);
  h.audio.observeItems('new', orders(1, 2));
  h.audio.observeItems('new', orders(1), 'FOOD');
  h.audio.observeItems('new', orders(1, 2), 'FOOD');
  assert.equal(h.calls.length, 1);
  h.store('12');
  h.audio.observeItems('new', orders(99));
  assert.equal(h.calls.length, 1);
});

test('completed polling and local KDS action share deduplication', () => {
  const h = harness();
  h.audio.observeItems('done', orders(1));
  assert.equal(h.audio.track('done', 2), true);
  h.audio.speak('Món số 2 đã xong');
  h.audio.observeItems('done', orders(1, 2));
  assert.equal(h.calls.length, 1);
  h.audio.observeItems('done', orders(1, 2, 3));
  assert.equal(h.calls.length, 2);
  assert.match(h.calls[1].text, /Gà sốt phô mai, bàn B03 đã xong/);
  assert.equal(h.audio.track('done', 3), false);
});

test('browser fallback uses Vietnamese language and actual saved volume', () => {
  const h = harness();
  delete h.window.onesoftAudio;
  h.window.SpeechSynthesisUtterance = function(text) { this.text = text; };
  h.window.speechSynthesis = { getVoices: () => [{ lang: 'vi-VN' }], speak: utterance => h.calls.push(utterance) };
  h.audio.speak('Tiếng Việt');
  assert.equal(h.calls[0].lang, 'vi-VN');
  assert.equal(h.calls[0].volume, 0.37);
  assert.equal(h.calls[0].text, 'Tiếng Việt');
});

test('unsupported audio produces an actionable error instead of silent success', () => {
  const h = harness();
  delete h.window.onesoftAudio;
  h.audio.speak('Kiểm tra');
  assert.equal(h.toasts[0][1], 'error');
  assert.match(h.toasts[0][0], /APK Android mới/);
});

for (const scenario of ['qr', 'cash', 'unpaid', 'failed']) {
  test(`checkout speaks only for successful confirmed QR payment (${scenario})`, async () => {
    const h = harness();
    h.window.appState = { setSelectedTable() {} };
    h.window.api.post = async () => {
      if (scenario === 'failed') throw new Error('offline');
      return { order: { id: 1, payment_status: scenario === 'unpaid' ? 'UNPAID' : 'PAID' }, payment: { amount: 73000 } };
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/checkout.js'), 'utf8'), {
      window: h.window, document: { getElementById: id => id === 'checkoutModal' ? { style: {} } : null }, console
    });
    Object.assign(h.window.checkoutModule, { currentOrder: { id: 1 }, openedFromExistingOrder: true, selectedMethod: scenario === 'cash' ? 'CASH' : 'QR' });
    await h.window.checkoutModule.executePayment();
    assert.equal(h.calls.length, scenario === 'qr' ? 1 : 0);
    if (scenario === 'qr') assert.match(h.calls[0].text, /Đã xác nhận thanh toán 73.000 đồng qua VietQR/);
  });
}

test('kitchen API polling is wired to new-order sound without replaying initial orders', async () => {
  const h = harness();
  let items = orders(1);
  h.window.api.get = async () => ({ orders: items });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/kds.js'), 'utf8'), {
    window: h.window, document: { getElementById: () => null }, console
  });
  await h.window.kdsModule.loadKdsOrders();
  assert.equal(h.calls.length, 0);
  items = orders(1, 2);
  await h.window.kdsModule.loadKdsOrders();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].kind, 'beep');
});
