'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { getCopy } = require('../js/i18n/translations.js');

const ar = getCopy('ar');
const en = getCopy('en');

test('Arabic and English copy define the same keys', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ar).sort());
  for (const group of Object.keys(ar).filter((key) => typeof ar[key] === 'object')) {
    assert.deepEqual(Object.keys(en[group]).sort(), Object.keys(ar[group]).sort(), `${group} keys differ`);
  }
});

test('every vault label used in vault-ui.js exists in both languages', () => {
  const source = fs.readFileSync('js/ui/vault-ui.js', 'utf8');
  const keys = new Set([...source.matchAll(/label\('(\w+)'/g)].map((m) => m[1]));
  assert.ok(keys.size > 20);
  for (const key of keys) {
    assert.ok(key in ar.vaultLabels, `ar.vaultLabels.${key} is missing`);
    assert.ok(key in en.vaultLabels, `en.vaultLabels.${key} is missing`);
  }
});

test('placeholders match between Arabic and English vault labels', () => {
  const placeholders = (text) => (String(text).match(/\{\w+\}/g) || []).sort().join(',');
  for (const key of Object.keys(ar.vaultLabels)) {
    assert.equal(placeholders(en.vaultLabels[key]), placeholders(ar.vaultLabels[key]), key);
  }
});
