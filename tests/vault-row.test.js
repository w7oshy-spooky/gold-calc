'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, safeImageSrc, buildPieceRowHtml } = require('../js/ui/vault-row.js');

const formatting = {
  formatMoney: (value) => value.toFixed(0),
  formatSar: (value) => `${value.toFixed(0)} SAR`,
};
const copy = { vaultLabels: {}, invoiceGramUnit: 'g' };
const label = (key, fallback, vars = {}) => String(fallback).replace(/\{(\w+)\}/g, (m, n) => (n in vars ? vars[n] : m));

function row(piece, currentVal = 1000) {
  return buildPieceRowHtml({ piece, currentVal, copy, formatting, label });
}

test('escapeHtml escapes markup characters', () => {
  assert.equal(escapeHtml(`<b>"x" & 'y'</b>`), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  assert.equal(escapeHtml(null), '');
});

test('safeImageSrc accepts only base64 image data URLs', () => {
  assert.equal(safeImageSrc('data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA');
  assert.equal(safeImageSrc('data:image/svg+xml;base64,AAAA'), '');
  assert.equal(safeImageSrc('javascript:alert(1)'), '');
  assert.equal(safeImageSrc('data:image/png;base64,AA" onerror="x'), '');
  assert.equal(safeImageSrc(undefined), '');
});

test('a malicious piece name cannot inject markup into the row', () => {
  const html = row({ id: 'a"b', name: '<img src=x onerror=alert(1)>', weight: 5, karat: 21 });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('data-id="a&quot;b"'));
});

test('row shows gain or loss against the purchase price', () => {
  const gain = row({ id: '1', name: 'Ring', weight: 5, karat: 21, purchasePrice: 800 });
  assert.match(gain, /▲ \+200 \(\+25\.0%\)/);
  const loss = row({ id: '1', name: 'Ring', weight: 5, karat: 21, purchasePrice: 1250 });
  assert.match(loss, /▼ -250 \(-20\.0%\)/);
  const none = row({ id: '1', name: 'Ring', weight: 5, karat: 21 });
  assert.ok(!none.includes('▲') && !none.includes('▼'));
});

test('row shows photo thumbnail or karat badge, and invoice button', () => {
  const withPhoto = row({ id: '1', name: 'Ring', weight: 5, karat: 21, imageDataUrl: 'data:image/jpeg;base64,AAAA', invoiceDataUrl: 'data:image/jpeg;base64,BBBB' });
  assert.ok(withPhoto.includes('piece-thumbnail'));
  assert.ok(withPhoto.includes('invoice-thumbnail-btn'));
  const without = row({ id: '1', name: 'Ring', weight: 5, karat: 18 });
  assert.ok(!without.includes('piece-thumbnail'));
  assert.ok(without.includes('>18K<'));
});
