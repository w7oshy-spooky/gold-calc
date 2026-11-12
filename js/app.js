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
    'GoldAuditorUI',
    'GoldQuickInputParser',
    'GoldVaultStore',
    'GoldCardCanvasGenerator',
    'GoldVaultUI',
    'GoldNavigationUI',
    'GoldThemeUI',
    'GoldGuideUI',
  ];

  if (requiredGlobals.some((name) => !globalThis[name])) {
    console.error('Gold calculator dependencies are not loaded.');
    return;
  }

  const priceConverter = globalThis.GoldPriceConverter;
  const core = globalThis.GoldCalculator;
  const locale = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const copy = globalThis.GoldTranslations.getCopy(locale);
  if (globalThis.GoldStaticText) globalThis.GoldStaticText.applyStaticText(document, locale);
  const formatting = globalThis.GoldFormatting.createFormatting(locale);
  const priceCache = globalThis.GoldPriceCache.createPriceCache();
  const livePriceClient = globalThis.GoldLivePriceClient.createLivePriceClient();
  const preferencesApi = globalThis.GoldPreferencesStore;
  const preferencesStore = preferencesApi.createPreferencesStore();
  const shareUiApi = globalThis.GoldShareUI;
  const quickInputParser = globalThis.GoldQuickInputParser;
  const vaultStore = globalThis.GoldVaultStore ? globalThis.GoldVaultStore.createVaultStore() : null;
  const cardCanvasGenerator = globalThis.GoldCardCanvasGenerator;
  const themeUi = globalThis.GoldThemeUI
    ? globalThis.GoldThemeUI.createThemeUI({
        document,
        window: globalThis,
        preferencesStore,
        vibrate,
      })
    : null;

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
  let userManuallyEditedWorkmanship = false;

  function syncInferredWorkmanship(targetFamily) {
    if (!core.inferLaborBenchmark || typeof transactionUi === 'undefined' || !transactionUi) return;
    const family = targetFamily || (typeof auditorUi !== 'undefined' && auditorUi?.getPieceFamily ? auditorUi.getPieceFamily() : 'ring_earring');
    const input = transactionUi.getTransactionInput();
    const inferred = core.inferLaborBenchmark({
      pieceFamily: family,
      weight: input.weight,
      karat: input.karat,
    });
    if (inferred && Number.isFinite(inferred.defaultLabor) && inferred.defaultLabor > 0) {
      transactionUi.applyInput({ workmanshipPerGram: inferred.defaultLabor });
    }
  }

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
      if (change.type === 'karat' || change.type === 'adjust' || change.type === 'labor-tax-mode') vibrate();
      if ((change.type === 'input' && change.id === 'workmanship') || (change.type === 'adjust' && change.id === 'workmanship')) {
        userManuallyEditedWorkmanship = true;
      } else if (!userManuallyEditedWorkmanship && (change.type === 'karat' || change.id === 'weight' || (change.type === 'adjust' && change.id === 'weight'))) {
        syncInferredWorkmanship();
      }
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
    const market = marketUi.getMarketInput();
    const prices = priceConverter.deriveMarketPrices(market);
    marketUi.renderMarketEquivalents(prices);
    marketUi.renderLiveQuoteKaratPrices(prices);
    marketUi.renderLiveStatus(quote, 'ready');
  }

  function applyLiveQuote(quote, status = 'ready') {
    marketUi.setLiveQuoteInput(Number(quote.priceUsdOunce));
    marketUi.renderLiveStatus(quote, status);
    marketUi.renderLiveKaratPrices(Number(quote.priceUsdOunce));
    calculate();
  }

  let activeShareBlob = null;
  let activeShareText = '';
  let activeShareFilename = 'gold-card.png';
  let activeShareTitle = 'حاسبة الذهب';

  const shareModal = document.getElementById('shareModal');
  const closeShareModalBtn = document.getElementById('closeShareModalBtn');
  const shareModalPreview = document.getElementById('shareModalPreview');
  const shareModalNativeBtn = document.getElementById('shareModalNativeBtn');
  const shareModalDownloadBtn = document.getElementById('shareModalDownloadBtn');
  const shareModalCopyBtn = document.getElementById('shareModalCopyBtn');
  const shareModalStatus = document.getElementById('shareModalStatus');

  function showShareModalStatus(msg) {
    if (shareModalStatus) {
      shareModalStatus.textContent = msg;
      setTimeout(() => {
        if (shareModalStatus) shareModalStatus.textContent = '';
      }, 3000);
    }
  }

  function openShareModal({ blob, summaryText, filename, title }) {
    activeShareBlob = blob;
    activeShareText = summaryText || '';
    activeShareFilename = filename || `gold-calc-${Date.now()}.png`;
    activeShareTitle = title || copy.shareLabels?.title || 'حاسبة الذهب';

    if (shareModal && shareModalPreview && blob) {
      if (shareModalPreview.src && shareModalPreview.src.startsWith('blob:')) {
        URL.revokeObjectURL(shareModalPreview.src);
      }
      shareModalPreview.src = URL.createObjectURL(blob);
      shareModal.hidden = false;
      shareModal.classList.remove('hidden');
    }
  }

  function closeShareModal() {
    if (shareModal) {
      shareModal.hidden = true;
      shareModal.classList.add('hidden');
    }
    if (shareModalPreview && shareModalPreview.src && shareModalPreview.src.startsWith('blob:')) {
      URL.revokeObjectURL(shareModalPreview.src);
      shareModalPreview.src = '';
    }
  }

  if (closeShareModalBtn) {
    closeShareModalBtn.addEventListener('click', closeShareModal);
  }

  if (shareModalNativeBtn) {
    shareModalNativeBtn.addEventListener('click', async () => {
      vibrate();
      if (!activeShareBlob || !cardCanvasGenerator) return;
      try {
        const res = await cardCanvasGenerator.shareOrDownloadCard({
          blob: activeShareBlob,
          filename: activeShareFilename,
          title: activeShareTitle,
          navigatorRef: globalThis.navigator,
          windowRef: globalThis.window,
        });
        if (res.method === 'download') {
          showShareModalStatus(copy.shareModalDownloadBtn ? `${copy.shareModalDownloadBtn} ✓` : 'تم التحميل ✓');
        }
      } catch (e) {
        console.error('Share native error', e);
      }
    });
  }

  if (shareModalDownloadBtn) {
    shareModalDownloadBtn.addEventListener('click', () => {
      vibrate();
      if (!activeShareBlob) return;
      const url = URL.createObjectURL(activeShareBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeShareFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showShareModalStatus(copy.shareModalDownloadBtn ? `${copy.shareModalDownloadBtn} ✓` : 'تم التحميل ✓');
    });
  }

  if (shareModalCopyBtn) {
    shareModalCopyBtn.addEventListener('click', async () => {
      vibrate();
      if (activeShareText && shareUi && typeof shareUi.copyToClipboard === 'function') {
        const ok = await shareUi.copyToClipboard(activeShareText);
        if (ok) {
          showShareModalStatus(copy.shareModalCopied || 'تم نسخ النص بنجاح ✓');
        }
      }
    });
  }

  const shareUi = shareUiApi.createShareUI({
    document,
    copy,
    formatting,
    navigator: globalThis.navigator,
    getSummary() {
      vibrate();
      return shareUiApi.buildSummaryText({
        result: lastResult,
        comparison: lastComparison,
        invoice: lastInvoice,
        quotedTotal: transactionUi.getTransactionInput().quotedTotal,
        price24k: getPrice24k(),
        copy,
        formatting,
      });
    },
    async onShareCard() {
      vibrate();
      const currentPrice24k = getPrice24k();
      if (!lastResult && !lastInvoice?.count) {
        shareUi.showStatus(copy.shareNeedsPrice, 'error');
        return;
      }
      const summaryText = shareUiApi.buildSummaryText({
        result: lastResult,
        comparison: lastComparison,
        invoice: lastInvoice,
        quotedTotal: transactionUi.getTransactionInput().quotedTotal,
        price24k: currentPrice24k,
        copy,
        formatting,
      });

      if (cardCanvasGenerator) {
        try {
          const blob = await cardCanvasGenerator.generateCardBlob({
            result: lastResult,
            invoice: lastInvoice,
            copy,
            locale,
            documentRef: document,
          });

          const filename = `gold-calc-${Date.now()}.png`;
          const title = copy.shareLabels?.title || 'حاسبة الذهب';

          openShareModal({ blob, summaryText, filename, title });

          await cardCanvasGenerator.shareOrDownloadCard({
            blob,
            filename,
            title,
            navigatorRef: globalThis.navigator,
            windowRef: globalThis.window,
          });
        } catch (err) {
          console.error('Failed to generate calculation card', err);
          shareUi.share();
        }
      } else {
        shareUi.share();
      }
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
    onTrend(trendData) {
      marketUi.renderGoldTrend(trendData);
    },
    onKaratChange(karat) {
      vibrate();
    },
  });

  const auditorUi = globalThis.GoldAuditorUI.createAuditorUI({
    document,
    core,
    formatting,
    copy,
    async onChange(change) {
      if (change.type === 'karat' || change.type === 'stone-toggle' || change.type === 'piece-family') vibrate();
      if (change.type === 'piece-family') {
        userManuallyEditedWorkmanship = false;
        syncInferredWorkmanship(change.pieceFamily);
      }
      if (change.type === 'share-card') {
        vibrate();
        if (cardCanvasGenerator) {
          try {
            const blob = await cardCanvasGenerator.generateCardBlob({
              audit: change.audit,
              advice: change.advice,
              copy,
              locale,
              documentRef: document,
            });
            const filename = `gold-audit-${Date.now()}.png`;
            const title = copy.shareLabels?.title || 'حاسبة الذهب';
            openShareModal({ blob, summaryText: '', filename, title });
            await cardCanvasGenerator.shareOrDownloadCard({
              blob,
              filename,
              title,
              navigatorRef: globalThis.navigator,
              windowRef: globalThis.window,
            });
          } catch (err) {
            console.error('Failed to export card image', err);
          }
        }
      } else {
        calculate();
      }
    },
  });

  const vaultUi = (globalThis.GoldVaultUI && globalThis.GoldVaultRow && globalThis.GoldVaultBackupUI) ? globalThis.GoldVaultUI.createVaultUI({
    document,
    vaultStore,
    core,
    formatting,
    copy,
    getPrice24k,
    onChange() {
      vibrate();
    },
  }) : null;

  const navigationUi = globalThis.GoldNavigationUI ? globalThis.GoldNavigationUI.createNavigationUI({
    document,
    window: globalThis.window,
    preferencesStore,
    vibrate,
    onChange(tab) {
      if (tab === 'calc') calculate();
    },
  }) : null;

  const guideUi = globalThis.GoldGuideUI ? globalThis.GoldGuideUI.createGuideUI({
    document,
    window: globalThis.window,
    vibrate,
    onSelectTab(tab) {
      if (navigationUi) navigationUi.setActiveTab(tab);
    },
  }) : null;

  if (globalThis.GoldNativeBackButton) globalThis.GoldNativeBackButton.setupBackButton({ document, navigation: navigationUi });

  if (globalThis.GoldAppLock) {
    globalThis.GoldAppLock.createAppLock({ document, labels: copy.vaultLabels }).init();
  }

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
    if (marketUi.isPriceLocked && marketUi.isPriceLocked() && !force) return;
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

  function derivePrices() {
    const market = marketUi.getMarketInput();
    const prices = priceConverter.deriveMarketPrices(market);
    marketUi.renderMarketEquivalents(prices);
    marketUi.renderLiveKaratPrices(prices);
    if (typeof marketUi.renderGramConversionPreview === 'function') {
      marketUi.renderGramConversionPreview(market, prices);
    }
    return { market, prices };
  }

  function getPrice24k() {
    return derivePrices().prices.gram24kSar;
  }

  function savePreferences() {
    if (restoring) return;
    const market = marketUi.getMarketInput();
    const input = transactionUi.getTransactionInput();
    const previous = preferencesStore.read();
    const source = liveFallbackActive ? 'live' : market.source;

    const toggle = document.getElementById('hasStonesToggle');
    const stoneInput = document.getElementById('stoneWeightInput');
    const hasStones = toggle ? toggle.checked : false;
    const stoneWeight = stoneInput && stoneInput.value ? Number(stoneInput.value) : undefined;

    preferencesStore.write({
      mode: input.mode,
      karat: input.karat,
      weight: input.weight,
      workmanshipPerGram: input.workmanshipPerGram,
      profitPerGram: input.profitPerGram,
      taxRate: input.taxRate,
      laborTaxMode: input.laborTaxMode,
      country: input.country || 'sa',
      deductionRate: input.deductionRate,
      // An automatic fallback is not the user's choice: keep LIVE as the saved source.
      source,
      // In LIVE mode (or its automatic fallback) the USD field holds a feed value, so keep the last manual entry.
      ouncePriceUsd: source === 'live' ? previous.ouncePriceUsd : market.ouncePriceUsd,
      ouncePriceSar: market.ouncePriceSar,
      gramPriceSar: market.gramPriceSar,
      gramKarat: market.gramKarat,
      hasStones,
      stoneWeight,
      invoice: invoiceItems,
    });
  }

  function calculate() {
    const { market, prices } = derivePrices();
    const price24k = prices.gram24kSar;
    priceChartUi.render(prices, {
      activeKarat: market.source === 'gram-sar' ? Number(market.gramKarat) : undefined,
    });
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
      laborTaxMode: input.laborTaxMode,
      workmanshipTaxInclusive: input.workmanshipTaxInclusive,
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

    if (auditorUi) {
      auditorUi.render({ price24k, karat: input.karat, taxRate: input.taxRate });
    }

    if (vaultUi) {
      vaultUi.render();
    }

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

    const toggle = document.getElementById('hasStonesToggle');
    if (toggle) toggle.checked = false;
    const container = document.getElementById('stoneWeightContainer');
    if (container) container.hidden = true;
    const stoneInput = document.getElementById('stoneWeightInput');
    if (stoneInput) stoneInput.value = '';

    setPriceSource('live');
  }

  function restoreInputs() {
    const prefs = preferencesStore.read();
    const { ouncePriceUsd, ...manualPrices } = prefs;
    invoiceItems = prefs.invoice || [];
    transactionUi.applyInput(prefs);

    if (prefs.hasStones !== undefined) {
      const toggle = document.getElementById('hasStonesToggle');
      if (toggle) {
        toggle.checked = Boolean(prefs.hasStones);
        const container = document.getElementById('stoneWeightContainer');
        if (container) container.hidden = !toggle.checked;
      }
    }
    if (prefs.stoneWeight !== undefined) {
      const stoneInput = document.getElementById('stoneWeightInput');
      if (stoneInput) stoneInput.value = prefs.stoneWeight;
    }

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
    if (globalThis.GoldOfflineSupport) globalThis.GoldOfflineSupport.registerOfflineSupport();
  }

  function initQuickInput() {
    const bar = document.getElementById('quickInputBar');
    if (!bar || !quickInputParser) return;

    bar.addEventListener('input', () => {
      const parsed = quickInputParser.parseQuickInput(bar.value);
      if (!parsed.success) return;

      if (parsed.karat) {
        transactionUi.setKarat(parsed.karat);
        auditorUi.setKarat(parsed.karat);
      }
      if (parsed.weight) {
        const weightInput = document.getElementById('weight');
        if (weightInput) weightInput.value = parsed.weight;
      }
      if (parsed.quotedTotal) {
        const quotedInput = document.getElementById('quotedTotal');
        if (quotedInput) quotedInput.value = parsed.quotedTotal;
      }
      if (parsed.pieceFamily && auditorUi.setPieceFamily) {
        auditorUi.setPieceFamily(parsed.pieceFamily);
        userManuallyEditedWorkmanship = false;
        syncInferredWorkmanship(parsed.pieceFamily);
      }
      if (parsed.hasStones) {
        const toggle = document.getElementById('hasStonesToggle');
        if (toggle && !toggle.checked) {
          toggle.checked = true;
          const container = document.getElementById('stoneWeightContainer');
          if (container) container.hidden = false;
        }
      }
      calculate();
    });
  }

  window.addEventListener('load', () => {
    restoreInputs();
    registerOfflineSupport();
    initQuickInput();
    if (vaultUi) vaultUi.render();
    setInterval(refreshLiveInBackground, 15 * 1000);
    document.addEventListener('visibilitychange', refreshLiveInBackground);

    document.querySelectorAll('[data-set-karat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = Number(btn.dataset.setKarat);
        if ([18, 21, 22, 24].includes(k)) {
          vibrate();
          transactionUi.setKarat(k);
          auditorUi.setKarat(k);
          if (!userManuallyEditedWorkmanship) {
            syncInferredWorkmanship();
          }
          calculate();
          savePreferences();
        }
      });
    });

    const quickRefreshBtn = document.getElementById('quickPriceRefreshBtn');
    if (quickRefreshBtn) {
      quickRefreshBtn.addEventListener('click', () => {
        vibrate();
        fetchLiveGoldPrice({ force: true });
      });
    }

    document.querySelectorAll('.num-input, .market-input').forEach((input) => {
      input.addEventListener('focus', () => {
        setTimeout(() => {
          if (typeof input.select === 'function') input.select();
        }, 20);
      });
    });
  });
})();
