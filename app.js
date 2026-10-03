(function () {
  'use strict';

  if (
    !globalThis.GoldPriceConverter ||
    !globalThis.GoldCalculator ||
    !globalThis.GoldFormatting ||
    !globalThis.GoldTranslations
  ) {
    console.error('Gold calculator dependencies are not loaded.');
    return;
  }

  const priceConverter = globalThis.GoldPriceConverter;
  const core = globalThis.GoldCalculator;
  const $ = (id) => document.getElementById(id);
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const LIVE_CACHE_KEY = 'gold-calc-live-quote-v1';
  const LIVE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

  const copy = globalThis.GoldTranslations.getCopy(locale);
  const {
    formatMoney,
    formatInput,
    formatSignedMoney,
    formatSignedPercent,
    sourceDisplayName,
    formatLiveTime,
  } = globalThis.GoldFormatting.createFormatting(locale);

  function installLiveUi() {
    const firstSourceButton = document.querySelector('.source-btn');
    const sourceGroup = firstSourceButton?.parentElement;
    if (sourceGroup && !sourceGroup.querySelector('[data-source="live"]')) {
      sourceGroup.classList.remove('grid-cols-2');
      sourceGroup.classList.add('grid-cols-3');
      sourceGroup.insertAdjacentHTML('afterbegin', `<button type="button" class="source-btn" data-source="live" aria-pressed="false">LIVE</button>`);
    }

    const warning = $('priceWarning');
    if (warning && !$('livePricePanel')) {
      warning.insertAdjacentHTML('afterend', `
        <div id="livePricePanel" class="live-price-panel mt-3" hidden>
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="live-dot" aria-hidden="true"></span>
                <strong id="livePriceStatus" class="text-xs text-gray-700">${copy.liveLoading}</strong>
              </div>
              <p id="liveUpdatedAt" class="text-[10px] text-gray-400 mt-1">—</p>
            </div>
            <button type="button" id="liveRefresh" class="live-refresh-btn" aria-label="${copy.refresh}">↻ ${copy.refresh}</button>
          </div>
          <div class="live-karat-grid mt-3" aria-label="Live karat prices">
            <div><span>24K</span><strong id="liveKarat24">—</strong></div>
            <div><span>22K</span><strong id="liveKarat22">—</strong></div>
            <div><span>21K</span><strong id="liveKarat21">—</strong></div>
            <div><span>18K</span><strong id="liveKarat18">—</strong></div>
          </div>
        </div>`);
    }

    const note = document.querySelector('main aside.input-card');
    if (note) note.innerHTML = copy.note;
  }

  installLiveUi();

  const inputs = {
    priceSource: $('priceSource'),
    ouncePriceUSD: $('ouncePriceUSD'),
    ouncePriceSAR: $('ouncePriceSAR'),
    gramPriceSAR: $('gramPriceSAR'),
    gramInputKarat: $('gramInputKarat'),
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
    liveRefresh: $('liveRefresh'),
  };

  let liveQuote = null;
  let liveFetchInFlight = false;

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

  function renderLiveKaratPrices(priceUsdOunce) {
    const price24k = priceConverter.ounceUsdTo24kSar(priceUsdOunce);
    setText('liveKarat24', `${formatMoney(price24k)} ${locale === 'ar' ? 'ر.س/ج' : 'SAR/g'}`);
    setText('liveKarat22', `${formatMoney(price24k * 22 / 24)} ${locale === 'ar' ? 'ر.س/ج' : 'SAR/g'}`);
    setText('liveKarat21', `${formatMoney(price24k * 21 / 24)} ${locale === 'ar' ? 'ر.س/ج' : 'SAR/g'}`);
    setText('liveKarat18', `${formatMoney(price24k * 18 / 24)} ${locale === 'ar' ? 'ر.س/ج' : 'SAR/g'}`);
  }

  function renderLiveStatus(quote, state) {
    const status = $('livePriceStatus');
    const updated = $('liveUpdatedAt');
    const dot = document.querySelector('.live-dot');
    if (!status || !updated) return;

    if (state === 'loading') {
      status.textContent = copy.liveLoading;
      status.dataset.state = 'loading';
      updated.textContent = '—';
    } else if (state === 'cached') {
      status.textContent = copy.liveCached;
      status.dataset.state = 'cached';
      updated.textContent = `${copy.lastUpdated}: ${formatLiveTime(quote.updatedAt)} · ${copy.source}: ${sourceDisplayName(quote.source)}`;
    } else if (state === 'error') {
      status.textContent = copy.liveUnavailable;
      status.dataset.state = 'error';
      updated.textContent = '—';
    } else {
      status.textContent = quote?.stale ? copy.liveStale : copy.liveReady;
      status.dataset.state = quote?.stale ? 'stale' : 'live';
      updated.textContent = `${copy.lastUpdated}: ${formatLiveTime(quote.updatedAt)} · ${copy.source}: ${sourceDisplayName(quote.source)}`;
    }

    if (dot) dot.dataset.state = status.dataset.state;
  }

  function cacheLiveQuote(quote) {
    try {
      localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify({ quote, storedAt: Date.now() }));
    } catch {}
  }

  function useCachedLiveQuote() {
    try {
      const cached = JSON.parse(localStorage.getItem(LIVE_CACHE_KEY) || 'null');
      if (!cached?.quote || !Number.isFinite(cached.storedAt)) return false;
      if (Date.now() - cached.storedAt > LIVE_CACHE_MAX_AGE_MS) return false;
      if (!Number.isFinite(Number(cached.quote.priceUsdOunce)) || Number(cached.quote.priceUsdOunce) <= 0) return false;
      applyLiveQuote(cached.quote, 'cached');
      return true;
    } catch {
      return false;
    }
  }

  function applyLiveQuote(quote, state = 'live') {
    liveQuote = quote;
    inputs.ouncePriceUSD.value = formatInput(Number(quote.priceUsdOunce), 2);
    renderLiveKaratPrices(Number(quote.priceUsdOunce));
    renderLiveStatus(quote, state);
    calculate();
  }

  function fallbackToManualPrice() {
    liveQuote = null;
    renderLiveStatus(null, 'error');
    inputs.ouncePriceUSD.value = '';
    setPriceSource('ounce-usd', { fetchLive: false });
    const warning = $('priceWarning');
    if (warning) {
      warning.textContent = copy.liveUnavailable;
      warning.classList.add('warning-text');
    }
  }

  async function fetchLiveGoldPrice({ force = false } = {}) {
    if (liveFetchInFlight) return;
    liveFetchInFlight = true;
    if (inputs.liveRefresh) inputs.liveRefresh.disabled = true;
    renderLiveStatus(liveQuote, 'loading');

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;

    try {
      const url = force ? `/api/gold-price?refresh=${Date.now()}` : '/api/gold-price';
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (!response.ok) throw new Error(`Live price HTTP ${response.status}`);
      const quote = await response.json();
      if (!Number.isFinite(Number(quote.priceUsdOunce)) || Number(quote.priceUsdOunce) <= 0) {
        throw new Error('Invalid live quote');
      }
      if (Number.isNaN(new Date(quote.updatedAt).getTime())) throw new Error('Invalid live timestamp');

      cacheLiveQuote(quote);
      applyLiveQuote(quote, 'live');
    } catch (error) {
      if (!useCachedLiveQuote()) fallbackToManualPrice();
    } finally {
      if (timeout) clearTimeout(timeout);
      liveFetchInFlight = false;
      if (inputs.liveRefresh) inputs.liveRefresh.disabled = false;
    }
  }

  function setPriceSource(source, options = {}) {
    const safeSource = ['live', 'ounce-usd', 'ounce-sar', 'gram-sar'].includes(source) ? source : 'live';
    inputs.priceSource.value = safeSource;

    document.querySelectorAll('.source-btn').forEach((button) => {
      const active = button.dataset.source === safeSource;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const liveMode = safeSource === 'live';
    const ounceUsdMode = safeSource === 'ounce-usd';
    const ounceSarMode = safeSource === 'ounce-sar';
    const gramSarMode = safeSource === 'gram-sar';

    $('ounceUsdInputPanel').hidden = !(liveMode || ounceUsdMode);
    $('ounceSarInputPanel').hidden = !ounceSarMode;
    $('gramSarInputPanel').hidden = !gramSarMode;
    inputs.ouncePriceUSD.readOnly = liveMode;
    inputs.marketPrice.readOnly = true;
    $('livePricePanel').hidden = !liveMode;
    $('priceModeHelp').textContent = liveMode
      ? copy.liveMode
      : ounceUsdMode
        ? copy.ounceMode
        : ounceSarMode
          ? copy.ounceSarMode
          : copy.gramSarMode;

    calculate();

    if (liveMode && options.fetchLive !== false) {
      fetchLiveGoldPrice();
    }
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

  function renderMarketEquivalents(prices) {
    const panel = $('marketEquivalentPanel');
    const available = prices.gram24kSar > 0;
    if (panel) panel.hidden = !available;
    if (!available) {
      inputs.marketPrice.value = '';
      return;
    }

    inputs.marketPrice.value = formatInput(prices.gram24kSar, 2);
    setText('equivalentOunceUSD', `${formatMoney(prices.ounceUsd)}`);
    setText('equivalentOunceSAR', `${formatMoney(prices.ounceSar)} ${locale === 'ar' ? 'ر.س' : 'SAR'}`);
    setText('equivalentGram24', `${formatMoney(prices.gram24kSar)} ${locale === 'ar' ? 'ر.س/ج' : 'SAR/g'}`);
    setText('equivalentGram22', `${formatMoney(prices.gram22kSar)} ${locale === 'ar' ? 'ر.س/ج' : 'SAR/g'}`);
    setText('equivalentGram21', `${formatMoney(prices.gram21kSar)} ${locale === 'ar' ? 'ر.س/ج' : 'SAR/g'}`);
    setText('equivalentGram18', `${formatMoney(prices.gram18kSar)} ${locale === 'ar' ? 'ر.س/ج' : 'SAR/g'}`);
  }

  function getPrice24k() {
    const prices = priceConverter.deriveMarketPrices({
      source: inputs.priceSource.value,
      ouncePriceUsd: inputs.ouncePriceUSD.value,
      ouncePriceSar: inputs.ouncePriceSAR.value,
      gramPriceSar: inputs.gramPriceSAR.value,
      gramKarat: inputs.gramInputKarat.value,
    });

    renderMarketEquivalents(prices);
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

    const warning = $('priceWarning');
    if (warning) {
      const needsPrice = price24k <= 0;
      if (!needsPrice || inputs.priceSource.value !== 'live') {
        warning.textContent = needsPrice ? copy.needPrice : '';
        warning.classList.toggle('warning-text', needsPrice);
      }
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
    const karat = priceConverter.normalizeKarat(value);
    inputs.gramInputKarat.value = karat;
    document.querySelectorAll('.gram-karat-btn').forEach((button) => {
      const active = Number(button.dataset.gramKarat) === karat;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    vibrate();
    calculate();
  }

  globalThis.adjust = adjust;
  globalThis.setKarat = setKarat;
  globalThis.setGramInputKarat = setGramInputKarat;
  globalThis.setPriceSource = setPriceSource;
  globalThis.setTransactionMode = setTransactionMode;
  globalThis.fetchLiveGoldPrice = fetchLiveGoldPrice;

  document.querySelectorAll('.source-btn').forEach((button) => {
    button.addEventListener('click', () => setPriceSource(button.dataset.source));
  });

  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => setTransactionMode(button.dataset.mode));
  });

  document.querySelectorAll('.gram-karat-btn').forEach((button) => {
    button.addEventListener('click', () => setGramInputKarat(button.dataset.gramKarat));
  });

  inputs.liveRefresh?.addEventListener('click', () => {
    vibrate();
    fetchLiveGoldPrice({ force: true });
  });

  inputs.taxRange.addEventListener('input', (event) => {
    const rate = core.clampTaxRate(event.target.value);
    inputs.tax.value = rate;
    calculate();
  });

  inputs.ouncePriceUSD.addEventListener('input', () => {
    if (inputs.priceSource.value === 'live') return;
    if (Number.parseFloat(inputs.ouncePriceUSD.value) < 0) inputs.ouncePriceUSD.value = '0';
    if (inputs.priceSource.value === 'ounce-usd') calculate();
  });

  inputs.ouncePriceSAR.addEventListener('input', () => {
    if (Number.parseFloat(inputs.ouncePriceSAR.value) < 0) inputs.ouncePriceSAR.value = '0';
    if (inputs.priceSource.value === 'ounce-sar') calculate();
  });

  inputs.gramPriceSAR.addEventListener('input', () => {
    if (Number.parseFloat(inputs.gramPriceSAR.value) < 0) inputs.gramPriceSAR.value = '0';
    if (inputs.priceSource.value === 'gram-sar') calculate();
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

  inputs.ouncePriceUSD.addEventListener('blur', () => {
    if (inputs.priceSource.value !== 'live') {
      sanitizeVisibleField(inputs.ouncePriceUSD, 2);
      calculate();
    }
  });
  inputs.ouncePriceSAR.addEventListener('blur', () => {
    sanitizeVisibleField(inputs.ouncePriceSAR, 2);
    calculate();
  });
  inputs.gramPriceSAR.addEventListener('blur', () => {
    sanitizeVisibleField(inputs.gramPriceSAR, 2);
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
