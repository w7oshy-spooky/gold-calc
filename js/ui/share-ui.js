(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldShareUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATUS_CLEAR_MS = 3000;

  function buildInvoiceLines(invoice, copy, formatting) {
    const lines = [`${copy.shareLabels.title} — ${copy.invoiceTitle} (${invoice.count})`];
    invoice.lines.forEach((line, index) => {
      const modeLabel = line.mode === 'sell' ? copy.invoiceSell : copy.invoiceBuy;
      const sign = line.mode === 'sell' ? '−' : '';
      lines.push(
        `${index + 1}. ${modeLabel} · ${line.weight} ${copy.invoiceGramUnit} · ${copy.invoiceKarat} ${line.karat}: ${sign}${formatting.formatSar(line.total)}`,
      );
    });
    const netLabel = invoice.net >= 0 ? copy.invoiceNetPay : copy.invoiceNetReceive;
    lines.push(`${netLabel}: ${formatting.formatSar(Math.abs(invoice.net))}`);
    return lines;
  }

  function buildPieceLines(result, copy, formatting) {
    const labels = copy.shareLabels;
    const selling = result.mode === 'sell';
    const resultLabels = selling ? copy.sellLabels : copy.buyLabels;
    const lines = [
      `${labels.title} — ${selling ? labels.sell : labels.buy}`,
      `${labels.weight}: ${result.weight} · ${labels.karat}: ${result.karat}`,
      `${labels.gramPrice}: ${formatting.formatSar(result.gramPrice)}`,
    ];

    if (selling) {
      lines.push(`${resultLabels.primary}: ${formatting.formatSar(result.rawMetalValue)}`);
      const sign = result.deductionValue > 0 ? '−' : '';
      lines.push(`${resultLabels.secondary} (${result.deductionRate}%): ${sign}${formatting.formatSar(result.deductionValue)}`);
    } else {
      lines.push(`${resultLabels.primary}: ${formatting.formatSar(result.goldCost)}`);
      lines.push(`${resultLabels.secondary}: ${formatting.formatSar(result.laborCost)}`);
      lines.push(`${resultLabels.vat} (${result.taxRate}%): ${formatting.formatSar(result.vat)}`);
    }

    lines.push(`${resultLabels.final}: ${formatting.formatSar(result.total)}`);
    return lines;
  }

  function buildSummaryText({ result, price24k, invoice, copy, formatting }) {
    const labels = copy.shareLabels;
    // With invoice items the invoice is what gets shared; the current piece is only a draft.
    const lines = invoice?.count > 0
      ? buildInvoiceLines(invoice, copy, formatting)
      : buildPieceLines(result, copy, formatting);

    if (price24k > 0) lines.push(`${labels.price24k}: ${formatting.formatSar(price24k)}`);
    lines.push(labels.disclaimer);
    return lines.join('\n');
  }

  function createShareUI({
    document,
    copy,
    navigator: nav,
    getSummary,
    onReset = () => {},
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required share UI element #${id}`);
      return element;
    };

    const shareButton = requireElement('shareSummary');
    const resetButton = requireElement('resetInputs');
    const status = requireElement('actionStatus');
    let statusTimer = null;

    function showStatus(message, state = 'ok') {
      status.textContent = message;
      status.dataset.state = state;
      if (statusTimer !== null) clearTimeoutImpl(statusTimer);
      statusTimer = setTimeoutImpl(() => {
        status.textContent = '';
        statusTimer = null;
      }, STATUS_CLEAR_MS);
    }

    async function share() {
      const summary = getSummary();
      if (!summary) {
        showStatus(copy.shareNeedsPrice, 'error');
        return;
      }

      if (nav && typeof nav.share === 'function') {
        try {
          await nav.share({ title: copy.shareLabels.title, text: summary });
          return;
        } catch (error) {
          // The user closed the share sheet: nothing to report.
          if (error?.name === 'AbortError') return;
        }
      }

      try {
        if (!nav?.clipboard || typeof nav.clipboard.writeText !== 'function') {
          throw new Error('Clipboard is unavailable.');
        }
        await nav.clipboard.writeText(summary);
        showStatus(copy.shareCopied);
      } catch {
        showStatus(copy.shareFailed, 'error');
      }
    }

    shareButton.addEventListener('click', () => {
      share();
    });

    resetButton.addEventListener('click', () => {
      onReset();
      showStatus(copy.resetDone);
    });

    return { share, showStatus };
  }

  return { STATUS_CLEAR_MS, buildSummaryText, createShareUI };
});
