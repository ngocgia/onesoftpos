const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('acorn');

test('POS scripts parse on WebViews with ES2020 syntax support', () => {
  const publicDir = path.join(__dirname, '../../public');
  const html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script[^>]+src="(js\/[^"?]+)/g)];
  assert.ok(scripts.length > 0);
  for (const [, file] of scripts) {
    const source = fs.readFileSync(path.join(publicDir, file), 'utf8');
    assert.doesNotThrow(() => parse(source, { ecmaVersion: 2020 }), file);
  }
});
