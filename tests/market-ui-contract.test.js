const marketUiApi = require('../js/ui/market-ui.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const arabic = fs.readFileSync('index.html', 'utf8');
const english = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const marketUi = fs.readFileSync('js/ui/market-ui.js', 'utf8');

const liveIds = [
  'livePricePanel',
  'liveRefresh',
  'livePriceStatus',
  'liveUpdatedAt',
  'liveKarat24',
  'liveKarat22',
  'liveKarat21',
  'liveKarat18',
];

test('both pages contain the complete LIVE panel as static HTML', () => {
  for (const html of [arabic, english]) {
    for (const id of liveIds) {
      assert.match(html, new RegExp(`id=["']${id}["']`));
    }
  }
});

test('Arabic and English expose the same market source DOM contract', () => {
  const ids = [
    'priceSource',
    'ounceUsdInputPanel',
    'ouncePriceUSD',
    'ounceSarInputPanel',
    'ouncePriceSAR',
    'gramSarInputPanel',
    'gramPriceSAR',
    'gramInputKarat',
    'marketPrice',
    'marketEquivalentPanel',
    'priceModeHelp',
    'priceWarning',
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

test('market UI module owns source and gram-karat presentation behavior', () => {
  assert.match(marketUi, /createMarketUI/);
  assert.match(marketUi, /setPriceSource/);
  assert.match(marketUi, /setGramInputKarat/);
  assert.match(marketUi, /renderMarketEquivalents/);
  assert.match(marketUi, /renderLiveStatus/);
  assert.match(marketUi, /renderLiveKaratPrices/);
  assert.match(marketUi, /getMarketInput/);
});

test('application no longer injects the LIVE structure at runtime', () => {
  assert.doesNotMatch(app, /installLiveUi/);
  assert.doesNotMatch(app, /insertAdjacentHTML/);
});

test('equivalent USD ounce output preserves the previous number-only display', () => {
  assert.match(
    marketUi,
    /equivalentOunceUSD\.textContent = formatting\.formatMoney\(prices\.ounceUsd\);/
  );
});

test('both pages expose gram-karat buttons with data-val and data-gram-karat', () => {
  for (const html of [arabic, english]) {
    for (const karat of ['18', '21', '22', '24']) {
      assert.match(html, new RegExp(`class="gram-karat-btn[^"]*"[^>]*data-val="${karat}"`));
      assert.match(html, new RegExp(`class="gram-karat-btn[^"]*"[^>]*data-gram-karat="${karat}"`));
    }
  }
});

test('gram conversion preview calculates and explains pure 24K price from entered karat', () => {
  const makeElement = (tag = 'div') => ({
    tagName: tag.toUpperCase(),
    value: '',
    textContent: '',
    hidden: false,
    dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    closest() { return null; },
  });

  const ids = [
    'priceSource',
    'ounceUsdInputPanel',
    'ouncePriceUSD',
    'ounceSarInputPanel',
    'ouncePriceSAR',
    'gramSarInputPanel',
    'gramPriceSAR',
    'gramInputKarat',
    'marketPrice',
    'priceModeHelp',
    'priceWarning',
    'marketEquivalentPanel',
    'equivalentOunceUSD',
    'equivalentOunceSAR',
    'equivalentGram24',
    'equivalentGram22',
    'equivalentGram21',
    'equivalentGram18',
    'livePricePanel',
    'liveRefresh',
    'livePriceStatus',
    'liveUpdatedAt',
    'liveKarat24',
    'liveKarat22',
    'liveKarat21',
    'liveKarat18',
    'gramConversionPreview',
    'gramPreview24k',
    'gramPreviewFormula',
  ];

  const byId = Object.fromEntries(ids.map((id) => [id, makeElement()]));
  const document = {
    getElementById: (id) => byId[id] || null,
    querySelectorAll: () => [],
  };
  const priceConverter = require('../js/core/price-converter.js');
  const formatting = require('../js/ui/formatting.js').createFormatting('ar');

  const ui = marketUiApi.createMarketUI({
    document,
    locale: 'ar',
    copy: {},
    formatting,
    priceConverter,
    onChange() {},
    onRefresh() {},
  });

  byId.priceSource.value = 'gram-sar';
  byId.gramPriceSAR.value = '500';
  byId.gramInputKarat.value = '22';

  const prices22 = priceConverter.deriveMarketPrices({
    source: 'gram-sar',
    gramPriceSar: '500',
    gramKarat: '22',
  });

  ui.renderLiveKaratPrices(prices22);
  ui.renderGramConversionPreview({ source: 'gram-sar', gramPriceSar: '500', gramKarat: '22' }, prices22);

  // 500 * (24 / 22) = 545.45
  assert.equal(byId.gramPreview24k.textContent, '545.45');
  assert.match(byId.gramPreviewFormula.textContent, /500\.00\s*×\s*\(24\s*÷\s*22\)\s*=\s*545\.45/);
  assert.equal(byId.liveKarat24.textContent, '545.45');
  assert.equal(byId.liveKarat22.textContent, '500.00');

  // Change to 21K: 500 * (24 / 21) = 571.43
  byId.gramInputKarat.value = '21';
  const prices21 = priceConverter.deriveMarketPrices({
    source: 'gram-sar',
    gramPriceSar: '500',
    gramKarat: '21',
  });
  ui.renderLiveKaratPrices(prices21);
  ui.renderGramConversionPreview({ source: 'gram-sar', gramPriceSar: '500', gramKarat: '21' }, prices21);

  assert.equal(byId.gramPreview24k.textContent, '571.43');
  assert.match(byId.gramPreviewFormula.textContent, /500\.00\s*×\s*\(24\s*÷\s*21\)\s*=\s*571\.43/);
  assert.equal(byId.liveKarat24.textContent, '571.43');
  assert.equal(byId.liveKarat21.textContent, '500.00');
});

test('market UI module exposes only its factory as public API', () => {
  assert.deepEqual(Object.keys(marketUiApi).sort(), ['createMarketUI']);
});
