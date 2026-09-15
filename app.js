(function () {
  'use strict';

  if (!globalThis.GoldCalculator) {
    console.error('GoldCalculator core is not loaded.');
    return;
  }

  const core = globalThis.GoldCalculator;
  const $ = (id) => document.getElementById(id);
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const LIVE_CACHE_KEY = 'gold-calc-live-quote-v1';
  const LIVE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

  const copy = {
    ar: {
      liveMode: 'يتم جلب سعر الأوقية الحي تلقائيًا ثم تحويله إلى سعر جرام 24 قيراط بالريال السعودي.',
      ounceMode: 'يتم احتساب سعر جرام 24 تلقائيًا من سعر الأوقية التي تدخلها دون تقريب مبكر.',
      manualMode: 'أدخل سعر جرام 24 يدويًا قبل المصنعية والضريبة.',
      needPrice: 'أدخل سعرًا صالحًا أو اختر LIVE لجلب السعر الحالي.',
      liveLoading: 'جاري تحديث سعر الذهب…',
      liveReady: 'LIVE · السعر الحي متصل',
      liveStale: 'السعر وصل من المصدر ولكنه متأخر قليلًا.',
      liveCached: 'تعذر التحديث الآن · يتم استخدام آخر سعر محفوظ مؤقتًا.',
      liveUnavailable: 'تعذر جلب السعر الحي ولا يوجد سعر محفوظ حديث. تم التحويل إلى إدخال الأوقية اليدوي.',
      refresh: 'تحديث',
      lastUpdated: 'آخر تحديث',
      source: 'المصدر',
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
      note: '<strong class="text-gray-700">ملاحظة:</strong> سعر LIVE سعر فوري إرشادي للذهب الخام XAU/USD ويُحوّل إلى الريال السعودي. النتائج تقديرية، وقد يختلف سعر التنفيذ الفعلي لدى المحلات بسبب فرق الشراء والبيع والمصنعية والأحجار والعروض والمعاملة الضريبية.',
    },
    en: {
      liveMode: 'The live troy-ounce price is fetched automatically and converted to the 24K gram price in Saudi riyals.',
      ounceMode: '24K price is calculated from the ounce price you enter without early rounding.',
      manualMode: 'Enter the 24K gram price manually before workmanship and VAT.',
      needPrice: 'Enter a valid price or choose LIVE to fetch the current price.',
      liveLoading: 'Updating live gold price…',
      liveReady: 'LIVE · price feed connected',
      liveStale: 'The provider returned a delayed quote.',
      liveCached: 'Live refresh failed · using the most recent cached quote temporarily.',
      liveUnavailable: 'Live pricing is unavailable and no recent cached quote exists. Switched to manual ounce entry.',
      refresh: 'Refresh',
      lastUpdated: 'Last updated',
      source: 'Source',
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
      note: '<strong class="text-gray-700">Note:</strong> LIVE uses an indicative XAU/USD raw-gold spot quote converted to Saudi riyals. Results are estimates; actual shop execution can differ because of bid/ask spreads, workmanship, stones, promotions and tax treatment.',
    },
  }[locale];

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

  function sourceDisplayName(source) {
    if (source === 'gold-api') return 'Gold API';
    if (source === 'xaus') return 'XAUS';
    return source || '—';
  }

  function formatLiveTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function renderLiveKaratPrices(priceUsdOunce) {
    const price24k = core.ounceUsdTo24kSar(priceUsdOunce);
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
    setPriceSource('ounce', { fetchLive: false });
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
    const safeSource = ['live', 'ounce', 'manual'].includes(source) ? source : 'live';
    inputs.priceSource.value = safeSource;

    document.querySelectorAll('.source-btn').forEach((button) => {
      const active = button.dataset.source === safeSource;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const liveMode = safeSource === 'live';
    const ounceMode = safeSource === 'ounce';
    inputs.ouncePriceUSD.disabled = safeSource === 'manual';
    inputs.ouncePriceUSD.readOnly = liveMode;
    inputs.marketPrice.readOnly = safeSource !== 'manual';
    $('livePricePanel').hidden = !liveMode;
    $('priceModeHelp').textContent = liveMode ? copy.liveMode : ounceMode ? copy.ounceMode : copy.manualMode;

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

  function getPrice24k() {
    const source = inputs.priceSource.value;
    let price24k = 0;

    if (source === 'live' || source === 'ounce') {
      price24k = core.ounceUsdTo24kSar(inputs.ouncePriceUSD.value);
      inputs.marketPrice.value = formatInput(price24k, 2);
    } else {
      price24k = core.resolvePrice24k({
        source: 'manual',
        manualPrice24k: inputs.marketPrice.value,
      });
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
      if (!needsPrice || inputs.priceSource.value !== 'live') {
        warning.textContent = needsPrice ? copy.needPrice : '';
        warning.classList.toggle('warning-text', needsPrice);
      }
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
  globalThis.fetchLiveGoldPrice = fetchLiveGoldPrice;

  document.querySelectorAll('.source-btn').forEach((button) => {
    button.addEventListener('click', () => setPriceSource(button.dataset.source));
  });

  document.querySelectorAll('.mode-btn').forEach((button) => {
    button.addEventListener('click', () => setTransactionMode(button.dataset.mode));
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

  inputs.ouncePriceUSD.addEventListener('blur', () => {
    if (inputs.priceSource.value !== 'live') sanitizeVisibleField(inputs.ouncePriceUSD, 2);
  });
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
    setTransactionMode(inputs.transactionMode.value || 'buy');
    setPriceSource('live');
  });
})();
