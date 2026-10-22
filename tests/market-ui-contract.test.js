const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const marketUiApi = require('../js/ui/market-ui.js');
const { createMarketUI } = marketUiApi;
const priceConverter = require('../js/core/price-converter.js');
const { createFormatting } = require('../js/ui/formatting.js');
const { getCopy } = require('../js/i18n/translations.js');

const arabic = fs.readFileSync('index.html', 'utf8');
const english = fs.readFileSync('en.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

test('both pages contain the live status row and its controls as static HTML', () => {
  for (const html of [arabic, english]) {
    for (const id of ['livePricePanel', 'liveRefresh', 'livePriceStatus', 'liveUpdatedAt']) {
      assert.match(html, new RegExp(`id=["']${id}["']`));
    }
  }
});

test('Arabic and English expose the same market source DOM contract', () => {
  const ids = [
    'priceSource', 'manualPanel', 'manualUnit', 'manualPrice', 'gramKaratPanel', 'gramInputKarat',
    'priceWarning', 'marketEquivalentPanel', 'equivOunceUsd', 'equivOunceSar',
    'equivKarat24', 'equivKarat22', 'equivKarat21', 'equivKarat18',
  ];
  for (const id of ids) {
    assert.match(arabic, new RegExp(`id=["']${id}["']`));
    assert.match(english, new RegExp(`id=["']${id}["']`));
  }
  for (const source of ['live', 'ounce-usd', 'ounce-sar', 'gram-sar']) {
    assert.match(arabic, new RegExp(`data-source=["']${source}["']`));
    assert.match(english, new RegExp(`data-source=["']${source}["']`));
  }
});

test('market UI module exposes only its factory as public API', () => {
  assert.deepEqual(Object.keys(marketUiApi).sort(), ['createMarketUI']);
});

test('application no longer injects markup at runtime', () => {
  assert.doesNotMatch(app, /insertAdjacentHTML/);
});

function fakeElement(extra = {}) {
  const listeners = {};
  return {
    value: '', hidden: false, textContent: '', dataset: {}, classList: { toggle() {}, add() {} },
    setAttribute() {}, querySelector: () => null,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    fire: (type) => listeners[type](),
    ...extra,
  };
}

function setup() {
  const elements = {};
  for (const id of [
    'priceSource', 'livePricePanel', 'liveRefresh', 'livePriceStatus', 'liveUpdatedAt', 'manualPanel', 'manualUnit',
    'manualPrice', 'gramKaratPanel', 'gramInputKarat', 'priceWarning', 'equivOunceUsd', 'equivOunceSar',
    'equivKarat24', 'equivKarat22', 'equivKarat21', 'equivKarat18',
  ]) elements[id] = fakeElement();
  elements.priceSource.value = 'live';
  elements.gramInputKarat.value = '24';
  const document = {
    getElementById: (id) => elements[id],
    querySelectorAll: () => [],
  };
  const changes = [];
  const ui = createMarketUI({
    document,
    copy: getCopy('en'),
    formatting: createFormatting('en'),
    priceConverter,
    onChange: (c) => changes.push(c),
  });
  return { ui, elements, changes };
}

test('live mode hides the manual field and feeds the live quote into the USD conversion', () => {
  const { ui, elements } = setup();
  assert.equal(elements.manualPanel.hidden, true);
  assert.equal(elements.livePricePanel.hidden, false);
  ui.setLiveQuoteInput(4312.4);
  assert.equal(ui.getMarketInput().ouncePriceUsd, 4312.4);
  assert.equal(ui.getManualValues().ouncePriceUsd, 0);
});

test('each manual source keeps its own entry and unit', () => {
  const { ui, elements } = setup();
  ui.setPriceSource('ounce-usd');
  elements.manualPrice.value = '4300';
  elements.manualPrice.fire('input');
  ui.setPriceSource('gram-sar');
  assert.equal(elements.manualPrice.value, '');
  assert.equal(elements.manualUnit.textContent, 'SAR/g');
  assert.equal(elements.gramKaratPanel.hidden, false);
  elements.manualPrice.value = '٤٥٠';
  elements.manualPrice.fire('input');
  assert.equal(elements.manualPrice.value, '450');
  ui.setPriceSource('ounce-usd');
  assert.equal(elements.manualPrice.value, '4300');
  assert.deepEqual(ui.getManualValues(), { ouncePriceUsd: 4300, ouncePriceSar: 0, gramPriceSar: 450, gramKarat: 24 });
});

test('equivalent prices render as plain numbers and dashes when there is no price', () => {
  const { ui, elements } = setup();
  ui.renderMarketEquivalents(priceConverter.deriveMarketPrices({ source: 'ounce-usd', ouncePriceUsd: 4312.4 }), 21);
  assert.equal(elements.equivOunceUsd.textContent, '4,312.40');
  assert.equal(elements.equivKarat21.textContent, '454.94');
  ui.renderMarketEquivalents(priceConverter.deriveMarketPrices({}), 21);
  assert.equal(elements.equivKarat24.textContent, '—');
});
