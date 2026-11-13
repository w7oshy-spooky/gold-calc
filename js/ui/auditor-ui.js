(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldAuditorUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createAuditorUI({
    document,
    core,
    formatting,
    copy,
    onChange = () => {},
  } = {}) {
    const el = (id) => document.getElementById(id);

    const elements = {
      panel: el('stealthAuditorSection') || el('stealthAuditorPanel'),
      weight: el('auditorWeight') || el('weight'),
      quotedTotal: el('auditorQuotedTotal') || el('quotedTotal'),
      rawGold: el('auditorRawGoldOutput'),
      vat: el('auditorVatOutput'),
      vatLabel: el('auditorVatLabel'),
      labor: el('auditorLaborOutput'),
      laborPerGram: el('auditorLaborPerGramOutput'),
      benchmarkBadge: el('auditorBenchmarkBadge'),
      hasStonesToggle: el('hasStonesToggle'),
      stoneWeightInput: el('stoneWeightInput'),
      stoneWeightContainer: el('stoneWeightContainer'),
      stoneLossCallout: el('stoneLossCallout'),
      stoneLossAmount: el('stoneLossAmount'),
      stoneGrossPriceOutput: el('stoneGrossPriceOutput'),
      stoneNetPriceOutput: el('stoneNetPriceOutput'),
      stoneGrossWeightLabel: el('stoneGrossWeightLabel'),
      stoneNetWeightLabel: el('stoneNetWeightLabel'),
      stoneGoldRatioValue: el('stoneGoldRatioValue'),
      stoneNetPriceHint: el('stoneNetPriceHint'),
      stoneZirconRegulationWarning: el('stoneZirconRegulationWarning'),
      stoneZirconRatio: el('stoneZirconRatio'),
      bargainingAdviceContainer: el('bargainingAdviceContainer'),
      fairPriceRangeOutput: el('fairPriceRangeOutput'),
      bargainAdviceText: el('bargainAdviceText'),
      copyBargainAdviceBtn: el('copyBargainAdviceBtn'),
      shareCardBtn: el('shareCardBtn'),
    };

    let latestAudit = null;
    let latestAdvice = null;

    if (elements.copyBargainAdviceBtn && elements.bargainAdviceText) {
      elements.copyBargainAdviceBtn.addEventListener('click', () => {
        const text = elements.bargainAdviceText.textContent;
        if (text && navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            const original = elements.copyBargainAdviceBtn.textContent;
            elements.copyBargainAdviceBtn.textContent = (copy.copiedLabel || '✓ تم النسخ');
            setTimeout(() => { elements.copyBargainAdviceBtn.textContent = original; }, 2000);
          }).catch(() => {});
        }
      });
    }

    if (elements.shareCardBtn) {
      elements.shareCardBtn.addEventListener('click', () => {
        onChange({ type: 'share-card', audit: latestAudit, advice: latestAdvice });
      });
    }

    let currentKarat = 21;
    const karatButtons = elements.panel
      ? Array.from(elements.panel.querySelectorAll('.auditor-karat-btn'))
      : [];

    function setKarat(karat) {
      currentKarat = Number(karat) || 21;
      karatButtons.forEach((btn) => {
        const active = Number(btn.dataset.val) === currentKarat;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    }

    karatButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setKarat(btn.dataset.val);
        onChange({ type: 'karat', karat: currentKarat });
      });
    });

    let currentPieceFamily = 'ring_earring';
    const pieceFamilyButtons = Array.from(document.querySelectorAll('.piece-family-btn'));

    function setPieceFamily(family) {
      if (!family) return;
      currentPieceFamily = family;
      pieceFamilyButtons.forEach((btn) => {
        const active = btn.dataset.family === currentPieceFamily;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    }

    pieceFamilyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setPieceFamily(btn.dataset.family);
        onChange({ type: 'piece-family', pieceFamily: currentPieceFamily });
      });
    });

    if (elements.hasStonesToggle) {
      elements.hasStonesToggle.addEventListener('change', () => {
        if (elements.stoneWeightContainer) {
          elements.stoneWeightContainer.hidden = !elements.hasStonesToggle.checked;
        }
        onChange({ type: 'stone-toggle', hasStones: elements.hasStonesToggle.checked });
      });
    }

    if (elements.stoneWeightInput) {
      elements.stoneWeightInput.addEventListener('input', () => onChange({ type: 'stone-weight' }));
    }

    function render({ price24k = 0, karat, taxRate, estimate = null } = {}) {
      if (!elements.panel) return null;

      const effectiveKarat = karat !== undefined ? Number(karat) : currentKarat;
      const effectiveTaxRate = taxRate !== undefined ? Number(taxRate) : 15;
      const weight = Number(elements.weight?.value) || 0;
      const quotedTotal = Number(elements.quotedTotal?.value) || 0;
      const hasStones = Boolean(elements.hasStonesToggle?.checked);
      const stoneWeight = hasStones ? (Number(elements.stoneWeightInput?.value) || 0) : 0;
      const netGoldWeight = (hasStones && stoneWeight > 0) ? Math.max(0.01, weight - stoneWeight) : weight;

      const audit = core.auditCounterQuote({
        price24k,
        karat: effectiveKarat,
        weight: netGoldWeight,
        quotedTotal,
        taxRate: effectiveTaxRate,
      });

      if (elements.vatLabel) {
        elements.vatLabel.textContent = (copy.vatLabel || 'ض.ق.م ({rate}%)').replace('{rate}', effectiveTaxRate);
      }

      if (!audit.available) {
        latestAudit = null;
        latestAdvice = null;
        if (elements.rawGold) elements.rawGold.textContent = '—';
        if (elements.vat) elements.vat.textContent = '—';
        if (elements.labor) elements.labor.textContent = '—';
        if (elements.laborPerGram) elements.laborPerGram.textContent = '—';
        if (elements.benchmarkBadge) {
          if (estimate && estimate.available) {
            const template = copy.expectedPriceRangeBadge || '💡 السعر العادل المتوقع للقطعة: {min} — {max} ر.س (المصنعية ~{labor} ر.س/جم)';
            elements.benchmarkBadge.textContent = template
              .replace('{min}', formatting.formatMoney(Math.round(estimate.minFairPrice)))
              .replace('{max}', formatting.formatMoney(Math.round(estimate.maxFairPrice)))
              .replace('{labor}', estimate.defaultLaborPerGram);
          } else {
            elements.benchmarkBadge.textContent = copy.comparePrompt || 'أدخل العرض والوزن';
          }
          elements.benchmarkBadge.className = 'benchmark-badge benchmark-neutral';
        }
        if (elements.quotedTotal) {
          if (estimate && estimate.available) {
            const placeholderTpl = copy.quotedPlaceholderFair || 'مثال لعرض عادل: ~ {offer} ر.س';
            elements.quotedTotal.placeholder = placeholderTpl.replace('{offer}', formatting.formatMoney(Math.round(estimate.midFairPrice)));
          } else {
            elements.quotedTotal.placeholder = copy.quotedTotalPlaceholder || 'أدخل العرض للمقارنة';
          }
        }
        if (elements.bargainingAdviceContainer) elements.bargainingAdviceContainer.hidden = true;
      } else {
        latestAudit = audit;
        if (elements.rawGold) elements.rawGold.textContent = formatting.formatMoney(audit.rawMetalCost);
        if (elements.vat) elements.vat.textContent = formatting.formatMoney(audit.vat);
        if (elements.labor) elements.labor.textContent = formatting.formatMoney(audit.laborCost);
        if (elements.laborPerGram) elements.laborPerGram.textContent = formatting.formatMoney(audit.laborPerGram);

        if (core.generateBargainingAdvice) {
          latestAdvice = core.generateBargainingAdvice({
            audit,
            pieceFamily: currentPieceFamily,
          });
          if (latestAdvice && latestAdvice.available && elements.bargainingAdviceContainer) {
            elements.bargainingAdviceContainer.hidden = false;
            if (elements.fairPriceRangeOutput) {
              elements.fairPriceRangeOutput.textContent = `${formatting.formatSar(latestAdvice.minFairPrice)} — ${formatting.formatSar(latestAdvice.maxFairPrice)}`;
            }
            if (elements.bargainAdviceText) {
              const offerStr = formatting.formatMoney(Math.round(latestAdvice.suggestedOffer));
              const template = copy.adviceLabels?.[latestAdvice.adviceTemplateKey]
                || copy.adviceLabels?.advice_negotiate_high
                || 'احسبها لي بـ {offer} وأتمم معك الآن.';
              elements.bargainAdviceText.textContent = template.replace('{offer}', offerStr);
            }
          }
        }

        if (elements.benchmarkBadge) {
          const badgeKey = latestAdvice?.verdictKey || audit.benchmarkCategory;
          const familyName = copy.pieceFamilies?.[currentPieceFamily] || '';
          const verdictLabel = copy.adviceLabels?.[badgeKey] || copy.benchmarks?.[badgeKey] || badgeKey;
          const rangeInfo = latestAdvice?.minFairLaborPerGram !== undefined
            ? ` (${latestAdvice.minFairLaborPerGram}–${latestAdvice.maxFairLaborPerGram} ر.س/ج)`
            : '';
          elements.benchmarkBadge.textContent = familyName ? `${familyName}${rangeInfo}: ${verdictLabel}` : verdictLabel;
          elements.benchmarkBadge.className = `benchmark-badge benchmark-${badgeKey}`;
        }
      }

      if (elements.hasStonesToggle && elements.stoneLossCallout) {
        if (hasStones && stoneWeight > 0 && (price24k > 0 || quotedTotal > 0)) {
          const stoneData = core.calculateStoneDeduction({
            grossWeight: weight,
            stoneWeight,
            hasStones: true,
            price24k,
            karat: effectiveKarat,
            workmanshipPerGram: audit.available ? audit.laborPerGram : 30,
            taxRate: effectiveTaxRate,
            quotedTotal: audit.available ? quotedTotal : 0,
          });

          elements.stoneLossCallout.hidden = false;
          if (elements.stoneLossAmount) {
            elements.stoneLossAmount.textContent = formatting.formatMoney(stoneData.stonePremiumPaid);
          }
          if (elements.stoneGrossPriceOutput) {
            elements.stoneGrossPriceOutput.textContent = formatting.formatMoney(stoneData.grossTotal);
          }
          if (elements.stoneNetPriceOutput) {
            elements.stoneNetPriceOutput.textContent = formatting.formatMoney(stoneData.pureGoldTotal);
          }
          if (elements.stoneGrossWeightLabel) {
            elements.stoneGrossWeightLabel.textContent = formatting.formatMoney(stoneData.grossWeight);
          }
          if (elements.stoneNetWeightLabel) {
            elements.stoneNetWeightLabel.textContent = formatting.formatMoney(stoneData.netGoldWeight);
          }
          if (elements.stoneGoldRatioValue) {
            elements.stoneGoldRatioValue.textContent = Number(stoneData.goldRatio).toFixed(1);
          }
          if (elements.stoneNetPriceHint) {
            elements.stoneNetPriceHint.textContent = formatting.formatMoney(stoneData.pureGoldTotal);
          }
          if (elements.stoneZirconRegulationWarning) {
            elements.stoneZirconRegulationWarning.hidden = !stoneData.exceedsZirconLimit;
            if (elements.stoneZirconRatio) {
              elements.stoneZirconRatio.textContent = Number(stoneData.stoneRatio).toFixed(1);
            }
          }
        } else {
          elements.stoneLossCallout.hidden = true;
        }
      }

      return audit;
    }

    return {
      render,
      setKarat,
      setPieceFamily,
      getPieceFamily: () => currentPieceFamily,
      getLatestAudit: () => latestAudit,
      getLatestAdvice: () => latestAdvice,
    };
  }

  return { createAuditorUI };
});
