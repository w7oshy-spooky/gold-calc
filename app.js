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

  let liveQuote = null;
  let liveFetchInFlight = false;

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
      calculate();
      if (change.type === 'source' && change.source === 'live') fetchLiveGoldPrice();
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
      if (change.type === 'karat') vibrate();
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
    const safeMode = transactionUi.setTransactionMode(mode);
    calculate();
    return safeMode;
  }

  function getPrice24k() {
    const prices = priceConverter.deriveMarketPrices(marketUi.getMarketInput());
    marketUi.renderMarketEquivalents(prices);
    return prices.gram24kSar;
  }

  function calculate() {
    const price24k = getPrice24k();
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

    quoteComparisonUi.render(core.compareQuote({
      mode: result.mode,
      referenceTotal: result.total,
      quotedTotal: input.quotedTotal,
    }));

    const needsPrice = price24k <= 0;
    if (!needsPrice) {
      marketUi.clearWarning();
    } else if (marketUi.getPriceSource() !== 'live') {
      marketUi.showWarning(copy.needPrice);
    }

    return result;
  }

  function adjust(id, amount) {
    const value = transactionUi.adjust(id, amount);
    vibrate();
    calculate();
    return value;
  }

  function setKarat(value) {
    const karat = transactionUi.setKarat(value);
    vibrate();
    calculate();
    return karat;
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

  window.addEventListener('load', () => {
    setTransactionMode('buy');
    setPriceSource('live');
  });
})();
