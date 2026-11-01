const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../gold-calculator.js');
const { createPreferencesStore } = require('../js/state/preferences-store.js');

test('defaultTaxRateForKarat treats 24K bullion as 0% exempt and others as standard rate', () => {
  assert.equal(core.defaultTaxRateForKarat(24), 0);
  assert.equal(core.defaultTaxRateForKarat(24, 15), 0);
  assert.equal(core.defaultTaxRateForKarat(22, 15), 15);
  assert.equal(core.defaultTaxRateForKarat(21, 15), 15);
  assert.equal(core.defaultTaxRateForKarat(18, 15), 15);
  assert.equal(core.defaultTaxRateForKarat(21, 5), 5);
});

test('calculateGoldPurchase defaults 24K bullion to 0% VAT when taxRate is unspecified', () => {
  const result = core.calculateGoldPurchase({
    price24k: 400,
    weight: 10,
    karat: 24,
    workmanshipPerGram: 10,
  });

  assert.equal(result.taxRate, 0);
  assert.equal(result.vat, 0);
  assert.equal(result.subtotal, 4100);
  assert.equal(result.total, 4100);
});

test('calculateGoldPurchase respects explicit taxRate on 24K if provided', () => {
  const result = core.calculateGoldPurchase({
    price24k: 400,
    weight: 10,
    karat: 24,
    workmanshipPerGram: 10,
    taxRate: 5,
  });

  assert.equal(result.taxRate, 5);
  assert.equal(result.vat, 4100 * 0.05);
});

test('calculateGoldPurchase handles workmanshipTaxInclusive correctly', () => {
  // 10g of 21K at 400 SAR 24K base -> 350 SAR/g gold -> 3500 SAR gold cost
  // Workmanship is 46 SAR/g inclusive of 15% VAT -> net is 40 SAR/g -> 400 SAR labor cost
  const inclusiveResult = core.calculateGoldPurchase({
    price24k: 400,
    weight: 10,
    karat: 21,
    workmanshipPerGram: 46,
    taxRate: 15,
    workmanshipTaxInclusive: true,
  });

  assert.equal(inclusiveResult.laborTaxMode, 'inclusive');
  assert.equal(inclusiveResult.rawWorkmanshipPerGram, 46);
  assert.ok(Math.abs(inclusiveResult.workmanshipPerGram - 40) < 1e-4);
  assert.ok(Math.abs(inclusiveResult.laborCost - 400) < 1e-4);
  assert.ok(Math.abs(inclusiveResult.subtotal - 3900) < 1e-4);
  assert.ok(Math.abs(inclusiveResult.vat - 585) < 1e-4);
  assert.ok(Math.abs(inclusiveResult.total - 4485) < 1e-4);

  // Compare with exclusive mode: 46 SAR/g exclusive + 15% VAT -> 52.90 SAR/g labor
  const exclusiveResult = core.calculateGoldPurchase({
    price24k: 400,
    weight: 10,
    karat: 21,
    workmanshipPerGram: 46,
    taxRate: 15,
    workmanshipTaxInclusive: false,
  });

  assert.equal(exclusiveResult.laborTaxMode, 'exclusive');
  assert.equal(exclusiveResult.workmanshipPerGram, 46);
  assert.equal(exclusiveResult.laborCost, 460);
  assert.equal(exclusiveResult.subtotal, 3960);
  assert.equal(exclusiveResult.vat, 3960 * 0.15);
});

test('auditCounterQuote supports quoteIncludesVat true and false', () => {
  // 10g of 21K (350 SAR/g gold = 3500 SAR raw gold).
  // Total quote 4600 inclusive of 15% VAT -> subtotal 4000 -> labor 500 (50/g).
  const incl = core.auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 4600,
    taxRate: 15,
    quoteIncludesVat: true,
  });

  assert.equal(incl.quoteIncludesVat, true);
  assert.ok(Math.abs(incl.subtotal - 4000) < 1e-4);
  assert.ok(Math.abs(incl.laborPerGram - 50) < 1e-4);

  // Quote 4000 exclusive of 15% VAT -> subtotal 4000, VAT 600, gross 4600 -> labor 500 (50/g).
  const excl = core.auditCounterQuote({
    price24k: 400,
    karat: 21,
    weight: 10,
    quotedTotal: 4000,
    taxRate: 15,
    quoteIncludesVat: false,
  });

  assert.equal(excl.quoteIncludesVat, false);
  assert.equal(excl.subtotal, 4000);
  assert.equal(excl.vat, 600);
  assert.equal(excl.quotedTotal, 4600);
  assert.ok(Math.abs(excl.laborPerGram - 50) < 1e-4);
});

test('COUNTRY_VAT_RATES exposes standard rates for regional countries', () => {
  assert.equal(core.COUNTRY_VAT_RATES.sa, 15);
  assert.equal(core.COUNTRY_VAT_RATES.ae, 5);
  assert.equal(core.COUNTRY_VAT_RATES.bh, 10);
  assert.equal(core.COUNTRY_VAT_RATES.om, 5);
  assert.equal(core.COUNTRY_VAT_RATES.kw, 0);
  assert.equal(core.COUNTRY_VAT_RATES.eg, 14);
});

test('preferences store serializes and validates laborTaxMode and country', () => {
  let stored = null;
  const storage = {
    getItem: () => stored,
    setItem: (_k, v) => { stored = v; },
  };
  const store = createPreferencesStore({ storage });

  store.write({
    weight: 10,
    laborTaxMode: 'inclusive',
    country: 'sa',
  });

  const readBack = store.read();
  assert.equal(readBack.laborTaxMode, 'inclusive');
  assert.equal(readBack.country, 'sa');

  // Rejects invalid laborTaxMode
  store.write({ laborTaxMode: 'invalid_mode' });
  const readInvalid = store.read();
  assert.equal(readInvalid.laborTaxMode, undefined);
});
test('transaction UI sets Saudi Arabia as the default country and handles 24K bullion without switching country', () => {
  const { createTransactionUI } = require('../js/ui/transaction-ui.js');
  const priceConverter = require('../js/core/price-converter.js');
  const { getCopy } = require('../js/i18n/translations.js');

  const values = {
    transactionMode: 'buy', weight: '10', karat: '21', workmanship: '35', profit: '0',
    tax: '15', taxRange: '15', sellDeduction: '0', quotedTotal: '',
  };
  const elements = {};
  for (const id of [
    'transactionMode', 'weight', 'karat', 'workmanship', 'profit', 'tax', 'taxRange', 'sellDeduction',
    'quotedTotal', 'buyCostsPanel', 'vatPanel', 'sellDeductionPanel', 'transactionHelp', 'quotedTotalLabel',
    'workmanshipLabel', 'profitLabel', 'sellDeductionLabel', 'taxLabel', 'taxValueLabel',
  ]) {
    elements[id] = {
      value: values[id] ?? '',
      hidden: false,
      textContent: '',
      dataset: {},
      style: { setProperty() {} },
      classList: { toggle() {} },
      setAttribute() {},
      addEventListener() {},
    };
  }

  const countryButtons = [
    { dataset: { country: 'sa', vat: '15' }, classList: { toggle() {} }, addEventListener() {} },
    { dataset: { country: 'ae', vat: '5' }, classList: { toggle() {} }, addEventListener() {} },
  ];

  const document = {
    getElementById: (id) => elements[id],
    querySelectorAll: (sel) => {
      if (sel === '.country-vat-btn') return countryButtons;
      return [];
    },
  };

  const ui = createTransactionUI({ document, core, priceConverter, copy: getCopy('ar') });
  const input = ui.getTransactionInput();
  assert.equal(input.country, 'sa');
  assert.equal(input.taxRate, '15');

  // Switch to 24K bullion -> tax becomes 0, country remains sa
  ui.setKarat(24);
  const bullionInput = ui.getTransactionInput();
  assert.equal(bullionInput.country, 'sa');
  assert.equal(bullionInput.taxRate, 0);

  // Switch back to 21K -> tax restores to 15%
  ui.setKarat(21);
  const jewelryInput = ui.getTransactionInput();
  assert.equal(jewelryInput.country, 'sa');
  assert.equal(jewelryInput.taxRate, 15);
});

test('calculateTransaction respects laborTaxMode and workmanshipTaxInclusive', () => {
  const excl = core.calculateTransaction({
    mode: 'buy',
    price24k: 400,
    weight: 10,
    karat: 21,
    workmanshipPerGram: 46,
    taxRate: 15,
    laborTaxMode: 'exclusive',
  });

  const incl = core.calculateTransaction({
    mode: 'buy',
    price24k: 400,
    weight: 10,
    karat: 21,
    workmanshipPerGram: 46,
    taxRate: 15,
    laborTaxMode: 'inclusive',
  });

  assert.equal(excl.laborTaxMode, 'exclusive');
  assert.equal(incl.laborTaxMode, 'inclusive');
  assert.equal(excl.workmanshipPerGram, 46);
  assert.ok(Math.abs(incl.workmanshipPerGram - 40) < 1e-4);
  assert.ok(incl.laborCost < excl.laborCost);
  assert.ok(incl.total < excl.total);
});

test('sanitizeInvoiceItem preserves laborTaxMode and workmanshipTaxInclusive', () => {
  const { sanitizeInvoiceItem } = require('../js/state/preferences-store.js');

  const inclItem = sanitizeInvoiceItem({
    mode: 'buy',
    weight: 10,
    karat: 21,
    workmanshipPerGram: 46,
    laborTaxMode: 'inclusive',
    workmanshipTaxInclusive: true,
  });

  assert.equal(inclItem.laborTaxMode, 'inclusive');
  assert.equal(inclItem.workmanshipTaxInclusive, true);

  const exclItem = sanitizeInvoiceItem({
    mode: 'buy',
    weight: 10,
    karat: 21,
    workmanshipPerGram: 46,
    laborTaxMode: 'exclusive',
  });

  assert.equal(exclItem.laborTaxMode, 'exclusive');
  assert.equal(exclItem.workmanshipTaxInclusive, false);
});

test('transactionUI setLaborTaxMode updates state and class toggles', () => {
  const { createTransactionUI } = require('../js/ui/transaction-ui.js');
  const priceConverter = require('../js/core/price-converter.js');
  const { getCopy } = require('../js/i18n/translations.js');

  const elements = {};
  for (const id of [
    'transactionMode', 'weight', 'karat', 'workmanship', 'profit', 'tax', 'taxRange', 'sellDeduction',
    'quotedTotal', 'buyCostsPanel', 'vatPanel', 'sellDeductionPanel', 'transactionHelp', 'quotedTotalLabel',
    'workmanshipLabel', 'profitLabel', 'sellDeductionLabel', 'taxLabel', 'taxValueLabel',
  ]) {
    elements[id] = {
      value: '0',
      hidden: false,
      textContent: '',
      dataset: {},
      style: { setProperty() {} },
      classList: { toggle() {} },
      setAttribute() {},
      addEventListener() {},
    };
  }

  const exclToggles = [];
  const inclToggles = [];
  const taxButtons = [
    {
      dataset: { laborTax: 'exclusive' },
      classList: { toggle: (cls, val) => exclToggles.push([cls, val]) },
      setAttribute: () => {},
      addEventListener: () => {},
    },
    {
      dataset: { laborTax: 'inclusive' },
      classList: { toggle: (cls, val) => inclToggles.push([cls, val]) },
      setAttribute: () => {},
      addEventListener: () => {},
    },
  ];

  const document = {
    getElementById: (id) => elements[id],
    querySelectorAll: (sel) => {
      if (sel === '.tax-mode-btn') return taxButtons;
      return [];
    },
  };

  const ui = createTransactionUI({ document, core, priceConverter, copy: getCopy('ar') });
  assert.equal(ui.getTransactionInput().laborTaxMode, 'exclusive');
  assert.equal(ui.getTransactionInput().workmanshipTaxInclusive, false);

  ui.setLaborTaxMode('inclusive');
  assert.equal(ui.getTransactionInput().laborTaxMode, 'inclusive');
  assert.equal(ui.getTransactionInput().workmanshipTaxInclusive, true);
});

test('tax mode buttons update tax slider between 0% and 15%', () => {
  const { createTransactionUI } = require('../js/ui/transaction-ui.js');
  const priceConverter = require('../js/core/price-converter.js');
  const { getCopy } = require('../js/i18n/translations.js');

  const elements = {};
  for (const id of [
    'transactionMode', 'weight', 'karat', 'workmanship', 'profit', 'tax', 'taxRange', 'sellDeduction',
    'quotedTotal', 'buyCostsPanel', 'vatPanel', 'sellDeductionPanel', 'transactionHelp', 'quotedTotalLabel',
    'workmanshipLabel', 'profitLabel', 'sellDeductionLabel', 'taxLabel', 'taxValueLabel',
  ]) {
    elements[id] = {
      value: id === 'tax' || id === 'taxRange' ? '15' : '0',
      hidden: false,
      textContent: '',
      dataset: {},
      style: { setProperty() {} },
      classList: { toggle() {} },
      setAttribute() {},
      addEventListener() {},
    };
  }

  const taxListeners = {};
  const taxButtons = [
    {
      dataset: { laborTax: 'exclusive' },
      classList: { toggle() {} },
      setAttribute: () => {},
      addEventListener: (evt, fn) => { taxListeners['exclusive'] = fn; },
    },
    {
      dataset: { laborTax: 'inclusive' },
      classList: { toggle() {} },
      setAttribute: () => {},
      addEventListener: (evt, fn) => { taxListeners['inclusive'] = fn; },
    },
  ];

  const document = {
    getElementById: (id) => elements[id],
    querySelectorAll: (sel) => {
      if (sel === '.tax-mode-btn') return taxButtons;
      return [];
    },
  };

  const changes = [];
  const ui = createTransactionUI({
    document,
    core,
    priceConverter,
    copy: getCopy('ar'),
    onChange: (change) => changes.push(change),
  });

  // Initially at 15%
  assert.equal(ui.getTransactionInput().taxRate, '15');
  assert.equal(ui.getTransactionInput().laborTaxMode, 'inclusive');

  // Click exclusive (بدون ضريبة): slider moves from 15 to 0
  taxListeners['exclusive']();
  assert.equal(elements.tax.value, 0);
  assert.equal(elements.taxRange.value, 0);
  assert.equal(ui.getTransactionInput().taxRate, 0);
  assert.equal(ui.getTransactionInput().laborTaxMode, 'exclusive');

  // Click inclusive (شامل الضريبة): slider moves back from 0 to 15
  taxListeners['inclusive']();
  assert.equal(elements.tax.value, 15);
  assert.equal(elements.taxRange.value, 15);
  assert.equal(ui.getTransactionInput().taxRate, 15);
  assert.equal(ui.getTransactionInput().laborTaxMode, 'inclusive');
});
