const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../public/js/device-display.js'), 'utf8');

function boot(stored, failStorage = false) {
  const properties = {};
  const elements = {};
  for (const id of ['deviceDisplayModal', 'deviceDisplayForm', 'menuItemDeviceDisplay', 'deviceDisplayPreset', 'deviceDisplayReset', 'deviceDisplayStatus']) {
    elements[id] = { style: {}, listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; }, querySelectorAll() { return []; } };
  }
  elements.deviceDisplayForm.elements = Object.fromEntries(['auto', 'top', 'bottom', 'left', 'right'].map(key => [key, {}]));
  let ready;
  let saved;
  vm.runInNewContext(source, {
    document: {
      documentElement: { style: { setProperty(key, value) { properties[key] = value; } } },
      addEventListener(name, fn) { ready = fn; },
      getElementById(id) { return elements[id]; }
    },
    localStorage: {
      getItem() { return stored; },
      setItem(key, value) { if (failStorage) throw new Error('Storage blocked'); saved = value; }
    }
  });
  ready();
  return { properties, elements, saved: () => saved };
}

test('startup handles missing/corrupt settings and clamps device offsets', () => {
  for (const stored of [null, '{bad', 'null']) {
    const state = boot(stored);
    assert.equal(state.properties['--pos-extra-top'], '0px');
    assert.match(state.properties['--pos-system-bottom'], /android-inset-bottom/);
  }
  const state = boot(JSON.stringify({ auto: false, top: -10, bottom: 999, left: 'bad', right: 14.6 }));
  assert.equal(state.properties['--pos-system-top'], '0px');
  assert.equal(state.properties['--pos-extra-top'], '0px');
  assert.equal(state.properties['--pos-extra-bottom'], '160px');
  assert.equal(state.properties['--pos-extra-left'], '0px');
  assert.equal(state.properties['--pos-extra-right'], '15px');
});

test('preset is only applied on save and survives reload; default reset keeps automatic insets', () => {
  const state = boot(null);
  state.elements.menuItemDeviceDisplay.listeners.click();
  state.elements.deviceDisplayPreset.listeners.click();
  assert.equal(state.properties['--pos-extra-bottom'], '0px');
  state.elements.deviceDisplayForm.listeners.submit({ preventDefault() {} });
  assert.equal(state.elements.deviceDisplayModal.style.display, 'none');
  const restored = boot(state.saved());
  assert.equal(restored.properties['--pos-extra-top'], '32px');
  assert.equal(restored.properties['--pos-extra-bottom'], '64px');
  restored.elements.deviceDisplayReset.listeners.click();
  restored.elements.deviceDisplayForm.listeners.submit({ preventDefault() {} });
  assert.equal(restored.properties['--pos-extra-bottom'], '0px');
  assert.match(restored.properties['--pos-system-bottom'], /android-inset-bottom/);
});

test('failed persistence keeps the dialog open and current layout unchanged', () => {
  const state = boot(null, true);
  state.elements.menuItemDeviceDisplay.listeners.click();
  state.elements.deviceDisplayPreset.listeners.click();
  state.elements.deviceDisplayForm.listeners.submit({ preventDefault() {} });
  assert.equal(state.elements.deviceDisplayModal.style.display, 'flex');
  assert.equal(state.properties['--pos-extra-bottom'], '0px');
  assert.match(state.elements.deviceDisplayStatus.textContent, /Không lưu được/);
});
