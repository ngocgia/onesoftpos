const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../public/js/brand-migration.js'), 'utf8');

test('rebranding preserves sessions, table drafts, themes and display preferences', () => {
  const values = new Map([
    ['thichgapos_token', 'existing-login'], ['thichgapos_store_id', '11'],
    ['thichgapos_table_cart_11_7_4', '{"items":[{"id":1}]}'],
    ['thichgapos_theme', 'dark'], ['thichgapos_device_display_v1', '{"top":24}'],
    ['unrelated', 'leave-alone']
  ]);
  const localStorage = {
    get length() { return values.size; },
    key: i => [...values.keys()][i],
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  vm.runInNewContext(source, { localStorage });
  assert.equal(values.get('onesoftpos_token'), 'existing-login');
  assert.equal(values.get('onesoftpos_store_id'), '11');
  assert.equal(values.get('onesoftpos_table_cart_11_7_4'), '{"items":[{"id":1}]}');
  assert.equal(values.get('onesoftpos_theme'), 'dark');
  assert.equal(values.get('onesoftpos_device_display_v1'), '{"top":24}');
  assert.equal(values.get('unrelated'), 'leave-alone');
  assert.equal([...values.keys()].some(key => key.startsWith('thichgapos_')), false);
  values.set('thichgapos_token', 'obsolete-login');
  vm.runInNewContext(source, { localStorage });
  assert.equal(values.get('onesoftpos_token'), 'existing-login');
  assert.equal(values.has('thichgapos_token'), false);
});

test('unavailable storage never breaks startup or deletes the existing value', () => {
  let removed = false;
  assert.doesNotThrow(() => vm.runInNewContext(source, { localStorage: {
    length: 1, key: () => 'thichgapos_theme', getItem: () => null,
    setItem() { throw new Error('quota'); }, removeItem() { removed = true; }
  } }));
  assert.equal(removed, false);
});

test('both web entries migrate device keys before any application script', () => {
  for (const file of ['index.html', 'admin.html']) {
    const html = fs.readFileSync(path.join(__dirname, '../../public', file), 'utf8');
    assert.match(html, /OnesoftPOS/);
    const scripts = [...html.matchAll(/<script[^>]+src="(js\/[^"?]+)/g)].map(match => match[1]);
    assert.equal(scripts[0], 'js/brand-migration.js');
  }
});
