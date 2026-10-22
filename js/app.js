(function () {
  'use strict';

  const requiredGlobals = [
    'GoldPriceConverter',
    'GoldCalculator',
    'GoldFormatting',
    'GoldTranslations',
    'GoldPriceCache',
    'GoldLivePriceClient',
    'GoldMarketUI',
    'GoldTransactionUI',
    'GoldQuoteComparisonUI',
    'GoldSummaryUI',
    'GoldPreferencesStore',
    'GoldShareUI',
    'GoldInvoiceUI',
    'GoldPriceChartUI',
  ];

  if (requiredGlobals.some((name) => !globalThis[name])) {
    console.error('Gold calculator dependencies are not loaded.');
    return;
  }

  const priceConverter = globalThis.GoldPriceConverter;
  const core = globalThis.GoldCalculator;
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const copy = globalThis.GoldTranslations.getCopy(locale);
  const formatting = globalThis.GoldFormatting.createFormatting(locale);
  const priceCache = globalThis.GoldPriceCache.createPriceCache();
  const livePriceClient = globalThis.GoldLivePriceClient.createLivePriceClient();
  const preferencesApi = globalThis.GoldPreferencesStore;
  const preferencesStore = preferencesApi.createPreferencesStore();
  const shareUiApi = globalThis.GoldShareUI;

  const LIVE_AUTO_REFRESH_MS = 60 * 1000;

  let liveFetchInFlight = false;
  let lastLiveFetchAt = 0;
  let lastResult = null;
  let lastComparison = null;
  let restoring = true;
  // True while the page fell back to manual entry on its own because LIVE failed.
  let liveFallbackActive = false;
  let liveFallbackNotice = '';
  let invoiceItems = [];
  let lastInvoice = null;

  function vibrate(ms = 8) {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  }

  const marketUi = globalThis.GoldMarketUI.createMarketUI({
    document,
    locale,
    copy,
    formatting,
    priceConverter,
    onChange(change) {
      if (change.type === 'gram-karat') vibrate();
      if (change.type === 'source') {
        liveFallbackActive = false;
        liveFallbackNotice = '';
        setPriceSource(change.source);
      } else {
        calculate();
      }
    },
    onRefresh() {
      vibrate();
      fetchLiveGoldPrice({ force: true });
    },
  });

  const transactionUi = globalThis.GoldTransactionUI.createTransactionUI({
    document,
    core,
    priceConverter,
    copy,
    onChange(change) {
      if (change.type === 'karat' || change.type === 'adjust') vibrate();
      calculate();
    },
  });

  const quoteComparisonUi = globalThis.GoldQuoteComparisonUI.createQuoteComparisonUI({
    document,
    copy,
    formatting,
  });

  const summaryUi = globalThis.GoldSummaryUI.createSummaryUI({
    document,
    copy,
    formatting,
  });

  function showLiveQuoteValues(quote) {
    marketUi.setLiveQuoteInput(Number(quote.priceUsdOunce));
    marketUi.renderLiveKaratPrices(Number(quote.priceUsdOunce));
  }

  function applyLiveQuote(quote, state = 'live') {
    showLiveQuoteValues(quote);
    marketUi.renderLiveStatus(quote, state);
    calculate();
  }

  shareUiApi.createShareUI({
    document,
    copy,
    navigator,
    getSummary() {
      if (!lastResult || lastResult.price24k <= 0) return '';
      return shareUiApi.buildSummaryText({
        result: lastResult,
        comparison: lastComparison,
        quotedTotal: transactionUi.getTransactionInput().quotedTotal,
        price24k: lastResult.price24k,
        invoice: lastInvoice,
        copy,
        formatting,
      });
    },
    onReset() {
      vibrate();
      resetInputs();
    },
  });

  const invoiceUi = globalThis.GoldInvoiceUI.createInvoiceUI({
    document,
    copy,
    formatting,
    onAdd() {
      addCurrentPieceToInvoice();
    },
    onRemove(index) {
      vibrate();
      invoiceItems = invoiceItems.filter((_, i) => i !== index);
      calculate();
    },
    onClear() {
      vibrate();
      invoiceItems = [];
      calculate();
      invoiceUi.showStatus(copy.invoiceCleared);
    },
  });

  const priceChartUi = globalThis.GoldPriceChartUI.createPriceChartUI({
    document,
    locale,
    formatting,
  });

  function addCurrentPieceToInvoice() {
    const item = preferencesApi.sanitizeInvoiceItem(transactionUi.getTransactionInput());
    if (!item) {
      invoiceUi.showStatus(copy.invoiceNeedsWeight, 'error');
      return;
    }
    if (invoiceItems.length >= preferencesApi.MAX_INVOICE_ITEMS) {
      invoiceUi.showStatus(copy.invoiceFull, 'error');
      return;
    }
    vibrate();
    invoiceItems = [...invoiceItems, item];
    calculate();
    invoiceUi.showStatus(copy.invoiceAdded);
  }

  function isLiveSource() {
    return marketUi.getPriceSource() === 'live';
  }

  function fallbackToManualPrice() {
    marketUi.renderLiveStatus(null, 'error');
    // Offline in a shop: start from the last known price (clearly dated) instead of an empty field.
    const lastKnownQuote = priceCache.readLastKnownQuote();
    if (lastKnownQuote) marketUi.setLiveQuoteInput(Number(lastKnownQuote.priceUsdOunce));
    else marketUi.clearLiveQuoteInput();
    liveFallbackActive = true;
    liveFallbackNotice = lastKnownQuote
      ? copy.liveOfflinePrefill.replace('{time}', formatting.formatLiveTime(lastKnownQuote.updatedAt))
      : copy.liveUnavailable;
    setPriceSource('ounce-usd', { fetchLive: false });
  }

  async function fetchLiveGoldPrice({ force = false, background = false } = {}) {
    if (liveFetchInFlight) return;
    liveFetchInFlight = true;
    lastLiveFetchAt = Date.now();
    marketUi.setLiveRefreshDisabled(true);
    // Background refreshes keep the current quote on screen instead of flashing a loading state.
    if (!background) marketUi.renderLiveStatus(null, 'loading');

    try {
      const quote = await livePriceClient.fetchQuote({ force });
      priceCache.writeCachedQuote(quote);
      // The user may have switched to a manual source while the request was in flight.
      if (isLiveSource()) applyLiveQuote(quote, 'live');
    } catch {
      if (!isLiveSource()) return;
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
    const fetchLive = safeSource === 'live' && options.fetchLive !== false;

    if (fetchLive) {
      // Show the last recent quote immediately while the fresh one loads.
      const cachedQuote = priceCache.readCachedQuote();
      if (cachedQuote) showLiveQuoteValues(cachedQuote);
    }

    calculate();
    if (fetchLive) fetchLiveGoldPrice();

    return safeSource;
  }

  function setTransactionMode(mode) {
    const safeMode = transactionUi.setTransactionMode(mode);
    calculate();
    return safeMode;
  }

  function getPrice24k() {
    const prices = priceConverter.deriveMarketPrices(marketUi.getMarketInput());
    marketUi.renderMarketEquivalents(prices);
    return prices.gram24kSar;
  }

  function savePreferences() {
    if (restoring) return;
    const market = marketUi.getMarketInput();
    const input = transactionUi.getTransactionInput();
    const previous = preferencesStore.read();
    const source = liveFallbackActive ? 'live' : market.source;
    preferencesStore.write({
      mode: input.mode,
      karat: input.karat,
      weight: input.weight,
      workmanshipPerGram: input.workmanshipPerGram,
      profitPerGram: input.profitPerGram,
      taxRate: input.taxRate,
      deductionRate: input.deductionRate,
      // An automatic fallback is not the user's choice: keep LIVE as the saved source.
      source,
      // In LIVE mode (or its automatic fallback) the USD field holds a feed value, so keep the last manual entry.
      ouncePriceUsd: source === 'live' ? previous.ouncePriceUsd : market.ouncePriceUsd,
      ouncePriceSar: market.ouncePriceSar,
      gramPriceSar: market.gramPriceSar,
      gramKarat: market.gramKarat,
      invoice: invoiceItems,
    });
  }

  function calculate() {
    const price24k = getPrice24k();
    priceChartUi.render(price24k);
    const input = transactionUi.getTransactionInput();
    const result = core.calculateTransaction({
      mode: input.mode,
      price24k,
      weight: input.weight,
      karat: input.karat,
      workmanshipPerGram: input.workmanshipPerGram,
      profitPerGram: input.profitPerGram,
      taxRate: input.taxRate,
      deductionRate: input.deductionRate,
    });

    transactionUi.renderInputLabels(result);
    summaryUi.render(result);

    const invoice = core.calculateInvoice({ price24k, items: invoiceItems });
    invoiceUi.render(invoice);
    transactionUi.setInvoiceActive(invoice.count > 0);

    // A shop quotes one total for the whole invoice: a positive net is paid, a negative one received.
    const comparison = invoice.count > 0
      ? core.compareQuote({
        mode: invoice.net >= 0 ? 'buy' : 'sell',
        referenceTotal: Math.abs(invoice.net),
        quotedTotal: input.quotedTotal,
      })
      : core.compareQuote({
        mode: result.mode,
        referenceTotal: result.total,
        quotedTotal: input.quotedTotal,
      });
    quoteComparisonUi.render(comparison);
    lastResult = result;
    lastComparison = comparison;
    lastInvoice = invoice;

    const needsPrice = price24k <= 0;
    if (liveFallbackNotice) {
      marketUi.showWarning(liveFallbackNotice);
    } else if (!needsPrice) {
      marketUi.clearWarning();
    } else if (marketUi.getPriceSource() !== 'live') {
      marketUi.showWarning(copy.needPrice);
    }

    savePreferences();
    return result;
  }

  function resetInputs() {
    preferencesStore.clear();
    liveFallbackActive = false;
    liveFallbackNotice = '';
    transactionUi.resetInput();
    marketUi.resetManualInput();
    setPriceSource('live');
  }

  function restoreInputs() {
    const prefs = preferencesStore.read();
    const { ouncePriceUsd, ...manualPrices } = prefs;
    invoiceItems = prefs.invoice || [];
    transactionUi.applyInput(prefs);
    // The USD field doubles as the LIVE feed display, so only restore it for manual USD entry.
    marketUi.applyManualInput(prefs.source === 'ounce-usd' ? prefs : manualPrices);
    setTransactionMode(prefs.mode || 'buy');
    restoring = false;
    setPriceSource(prefs.source || 'live');
  }

  function refreshLiveInBackground() {
    if (!isLiveSource() || document.visibilityState !== 'visible') return;
    if (Date.now() - lastLiveFetchAt < LIVE_AUTO_REFRESH_MS) return;
    fetchLiveGoldPrice({ background: true });
  }

  function registerOfflineSupport() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.addEventListener('load', () => {
    restoreInputs();
    registerOfflineSupport();
    setInterval(refreshLiveInBackground, 15 * 1000);
    document.addEventListener('visibilitychange', refreshLiveInBackground);
  });
})();
