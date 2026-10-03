(function () {
  'use strict';

  if (
    !globalThis.GoldPriceConverter ||
    !globalThis.GoldCalculator ||
    !globalThis.GoldFormatting ||
    !globalThis.GoldTranslations ||
    !globalThis.GoldPriceCache ||
    !globalThis.GoldLivePriceClient ||
    !globalThis.GoldMarketUI
  ) {
    console.error('Gold calculator dependencies are not loaded.');
    return;
  }

  const priceConverter = globalThis.GoldPriceConverter;
  const core = globalThis.GoldCalculator;
  const $ = (id) => document.getElementById(id);
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const copy = globalThis.GoldTranslations.getCopy(locale);
  const formatting = globalThis.GoldFormatting.createFormatting(locale);
  const {
    formatMoney,
    formatSignedMoney,
    formatSignedPercent,
  } = formatting;
  const priceCache = globalThis.GoldPriceCache.createPriceCache();
  const livePriceClient = globalThis.GoldLivePriceClient.createLivePriceClient();

  const inputs = {
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

  let liveQuote = null;
  let liveFetchInFlight = false;

  const marketUi = globalThis.GoldMarketUI.createMarketUI({
    document,
    locale,
    copy,
    formatting,
    priceConverter,
    onChange(change) {
      if (change.type === 'gram-karat') vibrate();
      calculate();
      if (change.type === 'source' && change.source === 'live') fetchLiveGoldPrice();
    },
    onRefresh() {
      vibrate();
      fetchLiveGoldPrice({ force: true });
    },
  });

  function vibrate(ms = 8) {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function sanitizeVisibleField(el, decimals = null) {
    const value = priceConverter.sanitizeNonNegative(el.value);
    if (el.value !== '' && (Number.parseFloat(el.value) < 0 || !Number.isFinite(Number.parseFloat(el.value)))) {
      el.value = '0';
    }
    if (decimals !== null && el.value !== '') {
      el.value = Number(value.toFixed(decimals)).toString();
    }
    return value;
  }

  function applyLiveQuote(quote, state = 'live') {
    liveQuote = quote;
    marketUi.setLiveQuoteInput(Number(quote.priceUsdOunce));
    marketUi.renderLiveKaratPrices(Number(quote.priceUsdOunce));
    marketUi.renderLiveStatus(quote, state);
    calculate();
  }

  function fallbackToManualPrice() {
    liveQuote = null;
    marketUi.renderLiveStatus(null, 'error');
    marketUi.clearLiveQuoteInput();
    setPriceSource('ounce-usd', { fetchLive: false });
    marketUi.showWarning(copy.liveUnavailable);
  }

  async function fetchLiveGoldPrice({ force = false } = {}) {
    if (liveFetchInFlight) return;
    liveFetchInFlight = true;
    marketUi.setLiveRefreshDisabled(true);
    marketUi.renderLiveStatus(liveQuote, 'loading');

    try {
      const quote = await livePriceClient.fetchQuote({ force });
      priceCache.writeCachedQuote(quote);
      applyLiveQuote(quote, 'live');
    } catch {
      const cachedQuote = priceCache.readCachedQuote();
      if (cachedQuote) applyLiveQuote(cachedQuote, 'cached');
      else fallbackToManualPrice();
    } finally {
      liveFetchInFlight = false;
      marketUi.setLiveRefreshDisabled(false);
    }
  }

  function setPriceSource(source, options = {}) {
    const safeSource = marketUi.setPriceSource(source);
    calculate();

    if (safeSource === 'live' && options.fetchLive !== false) {
      fetchLiveGoldPrice();
    }

    return safeSource;
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
    const prices = priceConverter.deriveMarketPrices(marketUi.getMarketInput());
    marketUi.renderMarketEquivalents(prices);
    return prices.gram24kSar;
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
    setText('workmanshipLabel', priceConverter.sanitizeNonNegative(inputs.workmanship.value));
    setText('profitLabel', priceConverter.sanitizeNonNegative(inputs.profit.value));
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

    const needsPrice = price24k <= 0;
    if (!needsPrice) {
      marketUi.clearWarning();
    } else if (marketUi.getPriceSource() !== 'live') {
      marketUi.showWarning(copy.needPrice);
    }
  }

  function adjust(id, amount) {
    const el = $(id);
    const current = priceConverter.sanitizeNonNegative(el.value);
    const next = Math.max(0, current + amount);
    el.value = id === 'weight' ? Number(next.toFixed(2)) : Math.round(next);
    vibrate();
    calculate();
  }

  function setKarat(value) {
    const karat = priceConverter.normalizeKarat(value);
    inputs.karat.value = karat;
    document.querySelectorAll('.karat-btn').forEach((button) => {
      const active = Number(button.dataset.val) === karat;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    vibrate();
    calculate();
  }

  function setGramInputKarat(value) {
    const karat = marketUi.setGramInputKarat(value);
    vibrate();
    calculate();
    return karat;
  }

  globalThis.adjust = adjust;
  globalThis.setKarat = setKarat;
  globalThis.setGramInputKarat = setGramInputKarat;
  globalThis.setPriceSource = setPriceSource;
  globalThis.setTransactionMode = setTransactionMode;
  globalThis.fetchLiveGoldPrice = fetchLiveGoldPrice;

  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => setTransactionMode(button.dataset.mode));
  });

  inputs.taxRange.addEventListener('input', (event) => {
    const rate = core.clampTaxRate(event.target.value);
    inputs.tax.value = rate;
    calculate();
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

  inputs.weight.addEventListener('blur', () => { sanitizeVisibleField(inputs.weight, 2); calculate(); });
  inputs.workmanship.addEventListener('blur', () => { sanitizeVisibleField(inputs.workmanship, 2); calculate(); });
  inputs.profit.addEventListener('blur', () => { sanitizeVisibleField(inputs.profit, 2); calculate(); });
  inputs.quotedTotal.addEventListener('blur', () => { sanitizeVisibleField(inputs.quotedTotal, 2); calculate(); });
  inputs.sellDeduction.addEventListener('blur', () => {
    inputs.sellDeduction.value = core.clampPercent(inputs.sellDeduction.value);
    calculate();
  });

  window.addEventListener('load', () => {
    setTransactionMode(inputs.transactionMode.value || 'buy');
    setPriceSource('live');
  });
})();
