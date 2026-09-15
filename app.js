(function () {
  'use strict';

  if (!globalThis.GoldCalculator) {
    console.error('GoldCalculator core is not loaded.');
    return;
  }

  const core = globalThis.GoldCalculator;
  const $ = (id) => document.getElementById(id);
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';

  const copy = {
    ar: {
      ounceMode: 'يتم احتساب سعر جرام 24 تلقائيًا من سعر الأوقية دون تقريب مبكر.',
      manualMode: 'أدخل سعر جرام 24 يدويًا قبل المصنعية والضريبة.',
      needPrice: 'أدخل سعر أوقية صالحًا أو اختر الإدخال اليدوي لسعر 24 قيراط.',
      buyHelp: 'وضع الشراء يضيف المصنعية والربح الاختياري والضريبة التي تحددها.',
      sellHelp: 'وضع البيع يعتمد قيمة الذهب الخام ويطرح فقط نسبة خصم المشتري التي تدخلها.',
      buyQuoteLabel: 'السعر الإجمالي المعروض من المحل (ر.س)',
      sellQuoteLabel: 'المبلغ الإجمالي الذي عرضه المشتري أو المحل (ر.س)',
      comparePrompt: 'أدخل عرض المحل لبدء المقارنة.',
      statuses: {
        close: 'العرض قريب من السعر المرجعي (ضمن ±2%).',
        moderate_high: 'العرض أعلى من المرجع قليلًا (بين 2% و5%).',
        high: 'العرض أعلى من المرجع بأكثر من 5%.',
        below_reference: 'العرض أقل من السعر المرجعي.',
        moderate_low: 'عرض الشراء أقل من المرجع قليلًا (بين 2% و5%).',
        low: 'عرض الشراء أقل من المرجع بأكثر من 5%.',
        above_reference: 'عرض الشراء أعلى من السعر المرجعي.',
      },
      buyLabels: {
        primary: 'تكلفة الذهب',
        secondary: 'مصنعية + ربح',
        subtotal: 'قبل الضريبة',
        final: 'السعر النهائي للدفع',
      },
      sellLabels: {
        primary: 'قيمة الذهب الخام',
        secondary: 'خصم المشتري',
        subtotal: 'صافي المبلغ المرجعي',
        final: 'المبلغ المرجعي المتوقع',
      },
    },
    en: {
      ounceMode: '24K price is calculated from the ounce price without early rounding.',
      manualMode: 'Enter the 24K gram price manually before workmanship and VAT.',
      needPrice: 'Enter a valid ounce price or switch to manual 24K pricing.',
      buyHelp: 'Buy mode adds workmanship, optional extra margin and the VAT rate you select.',
      sellHelp: 'Sell mode uses raw metal value and subtracts only the buyer deduction you enter.',
      buyQuoteLabel: 'Shop quoted total (SAR)',
      sellQuoteLabel: 'Buyer or shop offered total (SAR)',
      comparePrompt: 'Enter the quoted amount to start the comparison.',
      statuses: {
        close: 'The quote is close to the reference (within ±2%).',
        moderate_high: 'The quote is moderately above the reference (2% to 5%).',
        high: 'The quote is more than 5% above the reference.',
        below_reference: 'The quote is below the reference amount.',
        moderate_low: 'The buyback offer is moderately below the reference (2% to 5%).',
        low: 'The buyback offer is more than 5% below the reference.',
        above_reference: 'The buyback offer is above the reference amount.',
      },
      buyLabels: {
        primary: 'Gold cost',
        secondary: 'Workmanship + margin',
        subtotal: 'Before VAT',
        final: 'Final amount',
      },
      sellLabels: {
        primary: 'Raw metal value',
        secondary: 'Buyer deduction',
        subtotal: 'Reference net payout',
        final: 'Estimated reference payout',
      },
    },
  }[locale];

  const inputs = {
    priceSource: $('priceSource'),
    ouncePriceUSD: $('ouncePriceUSD'),
    marketPrice: $('marketPrice'),
    transactionMode: $('transactionMode'),
    weight: $('weight'),
    karat: $('karat'),
    workmanship: $('workmanship'),
    profit: $('profit'),
    tax: $('tax'),
    taxRange: $('taxRange'),
    sellDeduction: $('sellDeduction'),
    quotedTotal: $('quotedTotal'),
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

  function formatSignedMoney(value) {
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${formatMoney(Math.abs(value))} ${locale === 'ar' ? 'ر.س' : 'SAR'}`;
  }

  function formatSignedPercent(value) {
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${Math.abs(value).toFixed(2)}%`;
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
    $('priceModeHelp').textContent = ounceMode ? copy.ounceMode : copy.manualMode;
    calculate();
  }

  function setTransactionMode(mode) {
    const safeMode = core.normalizeMode(mode);
    inputs.transactionMode.value = safeMode;

    document.querySelectorAll('.mode-btn').forEach((button) => {
      const active = button.dataset.mode === safeMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const selling = safeMode === 'sell';
    $('buyCostsPanel').hidden = selling;
    $('vatPanel').hidden = selling;
    $('sellDeductionPanel').hidden = !selling;
    $('summaryTaxRow').hidden = selling;
    $('transactionHelp').textContent = selling ? copy.sellHelp : copy.buyHelp;
    $('quotedTotalLabel').textContent = selling ? copy.sellQuoteLabel : copy.buyQuoteLabel;

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

  function renderComparison(referenceTotal) {
    const comparison = core.compareQuote({
      mode: inputs.transactionMode.value,
      referenceTotal,
      quotedTotal: inputs.quotedTotal.value,
    });

    const status = $('comparisonStatus');
    if (!comparison.available) {
      status.textContent = copy.comparePrompt;
      status.dataset.status = 'unavailable';
      setText('comparisonDifference', '—');
      setText('comparisonPercent', '—');
      return;
    }

    status.textContent = copy.statuses[comparison.status] || copy.comparePrompt;
    status.dataset.status = comparison.status;
    setText('comparisonDifference', formatSignedMoney(comparison.difference));
    setText('comparisonPercent', formatSignedPercent(comparison.differencePct));
  }

  function calculate() {
    const price24k = getPrice24k();
    const mode = core.normalizeMode(inputs.transactionMode.value);
    const result = core.calculateTransaction({
      mode,
      price24k,
      weight: inputs.weight.value,
      karat: inputs.karat.value,
      workmanshipPerGram: inputs.workmanship.value,
      profitPerGram: inputs.profit.value,
      taxRate: inputs.tax.value,
      deductionRate: inputs.sellDeduction.value,
    });

    setText('karatPriceOutput', formatMoney(result.gramPrice));
    setText('selectedKaratLabel', result.karat);
    setText('summaryWeight', result.weight);
    setText('summaryKarat', result.karat);
    setText('workmanshipLabel', core.sanitizeNonNegative(inputs.workmanship.value));
    setText('profitLabel', core.sanitizeNonNegative(inputs.profit.value));
    setText('sellDeductionLabel', core.clampPercent(inputs.sellDeduction.value));

    const selling = mode === 'sell';
    const labels = selling ? copy.sellLabels : copy.buyLabels;
    setText('summaryPrimaryLabel', labels.primary);
    setText('summarySecondaryLabel', labels.secondary);
    setText('summarySubtotalLabel', labels.subtotal);
    setText('finalAmountLabel', labels.final);

    if (selling) {
      setText('goldCostOutput', formatMoney(result.rawMetalValue));
      setText('laborCostOutput', formatMoney(result.deductionValue));
      setText('subtotalOutput', formatMoney(result.total));
      setText('vatOutput', '0.00');
    } else {
      setText('goldCostOutput', formatMoney(result.goldCost));
      setText('laborCostOutput', formatMoney(result.laborCost));
      setText('subtotalOutput', formatMoney(result.subtotal));
      setText('vatOutput', formatMoney(result.vat));
      setText('taxLabel', result.taxRate);
      setText('taxValueLabel', result.taxRate);

      const pct = ((result.taxRate / 25) * 100).toFixed(1) + '%';
      inputs.taxRange.style.setProperty('--pct', pct);
    }

    setText('finalTotalOutput', formatMoney(result.total));
    renderComparison(result.total);

    const warning = $('priceWarning');
    if (warning) {
      const needsPrice = price24k <= 0;
      warning.textContent = needsPrice ? copy.needPrice : '';
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
  globalThis.setTransactionMode = setTransactionMode;

  document.querySelectorAll('.source-btn').forEach((button) => {
    button.addEventListener('click', () => setPriceSource(button.dataset.source));
  });

  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => setTransactionMode(button.dataset.mode));
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

  [inputs.weight, inputs.workmanship, inputs.profit, inputs.quotedTotal].forEach((el) => {
    el.addEventListener('input', () => {
      if (Number.parseFloat(el.value) < 0) el.value = '0';
      calculate();
    });
  });

  inputs.sellDeduction.addEventListener('input', () => {
    const rate = core.clampPercent(inputs.sellDeduction.value);
    if (Number.parseFloat(inputs.sellDeduction.value) < 0 || Number.parseFloat(inputs.sellDeduction.value) > 100) {
      inputs.sellDeduction.value = rate;
    }
    calculate();
  });

  inputs.ouncePriceUSD.addEventListener('blur', () => sanitizeVisibleField(inputs.ouncePriceUSD, 2));
  inputs.marketPrice.addEventListener('blur', () => sanitizeVisibleField(inputs.marketPrice, 2));
  inputs.weight.addEventListener('blur', () => { sanitizeVisibleField(inputs.weight, 2); calculate(); });
  inputs.workmanship.addEventListener('blur', () => { sanitizeVisibleField(inputs.workmanship, 2); calculate(); });
  inputs.profit.addEventListener('blur', () => { sanitizeVisibleField(inputs.profit, 2); calculate(); });
  inputs.quotedTotal.addEventListener('blur', () => { sanitizeVisibleField(inputs.quotedTotal, 2); calculate(); });
  inputs.sellDeduction.addEventListener('blur', () => {
    inputs.sellDeduction.value = core.clampPercent(inputs.sellDeduction.value);
    calculate();
  });

  window.addEventListener('load', () => {
    setPriceSource(inputs.priceSource.value || 'ounce');
    setTransactionMode(inputs.transactionMode.value || 'buy');
  });
})();