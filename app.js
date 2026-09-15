(function () {
  'use strict';

  if (!globalThis.GoldCalculator) {
    console.error('GoldCalculator core is not loaded.');
    return;
  }

  const core = globalThis.GoldCalculator;
  const $ = (id) => document.getElementById(id);
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const messages = {
    ar: {
      ounceMode: 'يتم احتساب سعر جرام 24 تلقائيًا من سعر الأوقية دون تقريب مبكر.',
      manualMode: 'أدخل سعر جرام 24 يدويًا قبل المصنعية والضريبة.',
      needPrice: 'أدخل سعر أوقية صالحًا أو اختر الإدخال اليدوي لسعر 24 قيراط.',
    },
    en: {
      ounceMode: '24K price is calculated from the ounce price without early rounding.',
      manualMode: 'Enter the 24K gram price manually before workmanship and VAT.',
      needPrice: 'Enter a valid ounce price or switch to manual 24K pricing.',
    },
  }[locale];

  const inputs = {
    priceSource: $('priceSource'),
    ouncePriceUSD: $('ouncePriceUSD'),
    marketPrice: $('marketPrice'),
    weight: $('weight'),
    karat: $('karat'),
    workmanship: $('workmanship'),
    profit: $('profit'),
    tax: $('tax'),
    taxRange: $('taxRange'),
  };

  function vibrate(ms = 8) {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  }

  function formatMoney(value) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatInput(value, decimals = 2) {
    if (!Number.isFinite(value) || value <= 0) return '';
    return value.toFixed(decimals);
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function sanitizeVisibleField(el, decimals = null) {
    const value = core.sanitizeNonNegative(el.value);
    if (el.value !== '' && (Number.parseFloat(el.value) < 0 || !Number.isFinite(Number.parseFloat(el.value)))) {
      el.value = '0';
    }
    if (decimals !== null && el.value !== '') {
      el.value = Number(value.toFixed(decimals)).toString();
    }
    return value;
  }

  function setPriceSource(source) {
    const safeSource = source === 'manual' ? 'manual' : 'ounce';
    inputs.priceSource.value = safeSource;

    document.querySelectorAll('.source-btn').forEach((button) => {
      const active = button.dataset.source === safeSource;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const ounceMode = safeSource === 'ounce';
    inputs.ouncePriceUSD.disabled = !ounceMode;
    inputs.marketPrice.readOnly = ounceMode;
    $('priceModeHelp').textContent = ounceMode ? messages.ounceMode : messages.manualMode;
    calculate();
  }

  function getPrice24k() {
    const source = inputs.priceSource.value;
    const price24k = core.resolvePrice24k({
      source,
      ouncePriceUsd: inputs.ouncePriceUSD.value,
      manualPrice24k: inputs.marketPrice.value,
    });

    if (source === 'ounce') {
      inputs.marketPrice.value = formatInput(price24k, 2);
    }

    return price24k;
  }

  function calculate() {
    const price24k = getPrice24k();
    const result = core.calculateGoldPurchase({
      price24k,
      weight: inputs.weight.value,
      karat: inputs.karat.value,
      workmanshipPerGram: inputs.workmanship.value,
      profitPerGram: inputs.profit.value,
      taxRate: inputs.tax.value,
    });

    setText('karatPriceOutput', formatMoney(result.gramPrice));
    setText('selectedKaratLabel', result.karat);
    setText('goldCostOutput', formatMoney(result.goldCost));
    setText('laborCostOutput', formatMoney(result.laborCost));
    setText('subtotalOutput', formatMoney(result.subtotal));
    setText('vatOutput', formatMoney(result.vat));
    setText('finalTotalOutput', formatMoney(result.total));
    setText('taxLabel', result.taxRate);
    setText('taxValueLabel', result.taxRate);
    setText('summaryWeight', result.weight);
    setText('summaryKarat', result.karat);
    setText('workmanshipLabel', result.workmanshipPerGram);
    setText('profitLabel', result.profitPerGram);

    const pct = ((result.taxRate / 25) * 100).toFixed(1) + '%';
    inputs.taxRange.style.setProperty('--pct', pct);

    const warning = $('priceWarning');
    if (warning) {
      const needsPrice = price24k <= 0;
      warning.textContent = needsPrice ? messages.needPrice : '';
      warning.classList.toggle('warning-text', needsPrice);
    }
  }

  function adjust(id, amount) {
    const el = $(id);
    const current = core.sanitizeNonNegative(el.value);
    const next = Math.max(0, current + amount);
    el.value = id === 'weight' ? Number(next.toFixed(2)) : Math.round(next);
    vibrate();
    calculate();
  }

  function setKarat(value) {
    const karat = core.normalizeKarat(value);
    inputs.karat.value = karat;
    document.querySelectorAll('.karat-btn').forEach((button) => {
      const active = Number(button.dataset.val) === karat;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    vibrate();
    calculate();
  }

  globalThis.adjust = adjust;
  globalThis.setKarat = setKarat;
  globalThis.setPriceSource = setPriceSource;

  document.querySelectorAll('.source-btn').forEach((button) => {
    button.addEventListener('click', () => setPriceSource(button.dataset.source));
  });

  inputs.taxRange.addEventListener('input', (event) => {
    const rate = core.clampTaxRate(event.target.value);
    inputs.tax.value = rate;
    calculate();
  });

  inputs.ouncePriceUSD.addEventListener('input', () => {
    if (Number.parseFloat(inputs.ouncePriceUSD.value) < 0) inputs.ouncePriceUSD.value = '0';
    calculate();
  });

  inputs.marketPrice.addEventListener('input', () => {
    if (Number.parseFloat(inputs.marketPrice.value) < 0) inputs.marketPrice.value = '0';
    if (inputs.priceSource.value === 'manual') calculate();
  });

  [inputs.weight, inputs.workmanship, inputs.profit].forEach((el) => {
    el.addEventListener('input', () => {
      if (Number.parseFloat(el.value) < 0) el.value = '0';
      calculate();
    });
  });

  inputs.ouncePriceUSD.addEventListener('blur', () => sanitizeVisibleField(inputs.ouncePriceUSD, 2));
  inputs.marketPrice.addEventListener('blur', () => sanitizeVisibleField(inputs.marketPrice, 2));
  inputs.weight.addEventListener('blur', () => { sanitizeVisibleField(inputs.weight, 2); calculate(); });
  inputs.workmanship.addEventListener('blur', () => { sanitizeVisibleField(inputs.workmanship, 2); calculate(); });
  inputs.profit.addEventListener('blur', () => { sanitizeVisibleField(inputs.profit, 2); calculate(); });

  window.addEventListener('load', () => setPriceSource(inputs.priceSource.value || 'ounce'));
})();