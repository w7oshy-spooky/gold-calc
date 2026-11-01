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
      labor: el('auditorLaborOutput'),
      laborPerGram: el('auditorLaborPerGramOutput'),
      benchmarkBadge: el('auditorBenchmarkBadge'),
      hasStonesToggle: el('hasStonesToggle'),
      stoneWeightInput: el('stoneWeightInput'),
      stoneWeightContainer: el('stoneWeightContainer'),
      stoneLossCallout: el('stoneLossCallout'),
      stoneLossAmount: el('stoneLossAmount'),
    };

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

    function render({ price24k = 0, karat } = {}) {
      if (!elements.panel) return null;

      const effectiveKarat = karat !== undefined ? Number(karat) : currentKarat;
      const weight = Number(elements.weight?.value) || 0;
      const quotedTotal = Number(elements.quotedTotal?.value) || 0;
      const hasStones = Boolean(elements.hasStonesToggle?.checked);
      const stoneWeight = hasStones ? (Number(elements.stoneWeightInput?.value) || 0) : 0;

      const audit = core.auditCounterQuote({
        price24k,
        karat: effectiveKarat,
        weight,
        quotedTotal,
        taxRate: 15,
      });

      if (!audit.available) {
        if (elements.rawGold) elements.rawGold.textContent = '—';
        if (elements.vat) elements.vat.textContent = '—';
        if (elements.labor) elements.labor.textContent = '—';
        if (elements.laborPerGram) elements.laborPerGram.textContent = '—';
        if (elements.benchmarkBadge) {
          elements.benchmarkBadge.textContent = copy.comparePrompt || 'أدخل العرض والوزن';
          elements.benchmarkBadge.className = 'benchmark-badge benchmark-neutral';
        }
      } else {
        if (elements.rawGold) elements.rawGold.textContent = formatting.formatMoney(audit.rawMetalCost);
        if (elements.vat) elements.vat.textContent = formatting.formatMoney(audit.vat);
        if (elements.labor) elements.labor.textContent = formatting.formatMoney(audit.laborCost);
        if (elements.laborPerGram) elements.laborPerGram.textContent = formatting.formatMoney(audit.laborPerGram);

        if (elements.benchmarkBadge) {
          const badgeKey = audit.benchmarkCategory;
          const label = copy.benchmarks?.[badgeKey] || badgeKey;
          elements.benchmarkBadge.textContent = label;
          elements.benchmarkBadge.className = `benchmark-badge benchmark-${badgeKey}`;
        }
      }

      if (elements.hasStonesToggle && elements.stoneLossCallout) {
        if (hasStones && stoneWeight > 0 && price24k > 0) {
          const stoneData = core.calculateStoneDeduction({
            grossWeight: weight,
            stoneWeight,
            hasStones: true,
            price24k,
            karat: effectiveKarat,
            workmanshipPerGram: audit.available ? audit.laborPerGram : 30,
            taxRate: 15,
          });

          elements.stoneLossCallout.hidden = false;
          if (elements.stoneLossAmount) {
            elements.stoneLossAmount.textContent = formatting.formatMoney(stoneData.stonePremiumPaid);
          }
        } else {
          elements.stoneLossCallout.hidden = true;
        }
      }

      return audit;
    }

    return { render, setKarat };
  }

  return { createAuditorUI };
});
