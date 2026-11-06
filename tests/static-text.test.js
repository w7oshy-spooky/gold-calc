'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DICTIONARIES, applyStaticText } = require('../js/i18n/static-text.js');

const page = fs.readFileSync('index.html', 'utf8');

function usedKeys() {
  const keys = new Set();
  for (const match of page.matchAll(/\sdata-t="([^"]+)"/g)) keys.add(match[1]);
  for (const match of page.matchAll(/\sdata-t-attr="([^"]+)"/g)) {
    for (const pair of match[1].split(';')) keys.add(pair.split(':')[1]);
  }
  return keys;
}

test('every static text key in index.html has an English translation', () => {
  const missing = [...usedKeys()].filter((key) => !(key in DICTIONARIES.en));
  assert.deepEqual(missing, []);
});

test('the English dictionary has no unused keys', () => {
  const used = usedKeys();
  const unused = Object.keys(DICTIONARIES.en).filter((key) => !used.has(key));
  assert.deepEqual(unused, []);
});

test('applyStaticText replaces text and attributes for English only', () => {
  const key = Object.keys(DICTIONARIES.en)[0];
  const makeNode = (attrs) => ({
    attrs,
    textContent: 'arabic',
    getAttribute(name) { return this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
  });
  const textNode = makeNode({ 'data-t': key });
  const attrNode = makeNode({ 'data-t-attr': `title:${key}` });
  const doc = {
    querySelectorAll: (selector) => (selector === '[data-t]' ? [textNode] : [attrNode]),
  };

  assert.equal(applyStaticText(doc, 'ar'), 0);
  assert.equal(textNode.textContent, 'arabic');

  assert.equal(applyStaticText(doc, 'en'), 2);
  assert.equal(textNode.textContent, DICTIONARIES.en[key]);
  assert.equal(attrNode.attrs.title, DICTIONARIES.en[key]);
});

test('language is chosen before first paint and the switch link works without JS', () => {
  assert.match(page, /lang=\(ar\|en\)/);
  assert.match(page, /class="lang-switch" href="\?lang=en"/);
});

test('en.html only redirects old links to the single page', () => {
  const stub = fs.readFileSync('en.html', 'utf8');
  assert.match(stub, /http-equiv="refresh"[^>]*url=index\.html\?lang=en/);
  assert.doesNotMatch(stub, /<script/);
});
