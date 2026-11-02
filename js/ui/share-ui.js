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
      const sign = result.deductionValue > 0 ? '−' : '';
      lines.push(`${resultLabels.primary}: ${formatting.formatSar(result.rawMetalValue)}`);
      lines.push(`${resultLabels.secondary} (${result.deductionRate}%): ${sign}${formatting.formatSar(result.deductionValue)}`);
    } else {
      lines.push(`${resultLabels.primary}: ${formatting.formatSar(result.goldCost)}`);
      lines.push(`${resultLabels.secondary}: ${formatting.formatSar(result.laborCost)}`);
      lines.push(`${labels.vat} (${result.taxRate}%): ${formatting.formatSar(result.vat)}`);
    }

    lines.push(`${resultLabels.final}: ${formatting.formatSar(result.total)}`);
    return lines;
  }

  function buildSummaryText({ result, comparison, quotedTotal, price24k, invoice, copy, formatting }) {
    const labels = copy.shareLabels;
    // With invoice items the invoice is what gets shared; the current piece is only a draft.
    const lines = invoice?.count > 0
      ? buildInvoiceLines(invoice, copy, formatting)
      : buildPieceLines(result, copy, formatting);

    if (comparison?.available) {
      lines.push(
        `${labels.quote}: ${formatting.formatSar(Number(quotedTotal))} (${formatting.formatSignedMoney(comparison.difference)} · ${formatting.formatSignedPercent(comparison.differencePct)})`,
      );
    }

    if (price24k > 0) lines.push(`${labels.price24k}: ${formatting.formatSar(price24k)}`);
    lines.push(labels.disclaimer);
    return lines.join('\n');
  }

  function createShareUI({
    document,
    copy,
    navigator: nav = (typeof globalThis !== 'undefined' ? globalThis.navigator : null),
    getSummary,
    onShare,
    onReset = () => {},
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  }) {
    const getSummaryFn = getSummary || onShare;
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

    async function copyToClipboard(text) {
      if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
        try {
          await nav.clipboard.writeText(text);
          return true;
        } catch {
          // Fall through to document.execCommand fallback
        }
      }

      try {
        if (typeof document?.createElement === 'function' && document?.body) {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          textarea.style.pointerEvents = 'none';
          textarea.style.top = '0';
          textarea.style.left = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const copied = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (copied) return true;
        }
      } catch {
        // Fallback failed
      }

      return false;
    }

    async function share() {
      if (typeof getSummaryFn !== 'function') {
        showStatus(copy.shareFailed, 'error');
        return;
      }

      let summary = '';
      try {
        summary = getSummaryFn();
      } catch {
        showStatus(copy.shareFailed, 'error');
        return;
      }

      if (!summary) {
        showStatus(copy.shareNeedsPrice, 'error');
        return;
      }

      // 1. Capacitor Native Share Plugin (Mobile Android/iOS APK)
      const capShare = (typeof globalThis !== 'undefined' ? globalThis.Capacitor?.Plugins?.Share : null);
      if (capShare && typeof capShare.share === 'function') {
        try {
          await capShare.share({
            title: copy.shareLabels.title,
            text: summary,
            dialogTitle: copy.shareLabels.title,
          });
          return;
        } catch (error) {
          const msg = String(error?.message || '').toLowerCase();
          if (error?.name === 'AbortError' || msg.includes('canceled') || msg.includes('cancelled')) {
            return;
          }
        }
      }

      // 2. Web Share API (Safari iOS, Chrome Mobile, Android Browser)
      if (nav && typeof nav.share === 'function') {
        try {
          await nav.share({ title: copy.shareLabels.title, text: summary });
          return;
        } catch (error) {
          // The user closed the share sheet: nothing to report.
          if (error?.name === 'AbortError') return;
        }
      }

      // 3. Modern Clipboard and Fallback (Desktop / Web fallback)
      const copied = await copyToClipboard(summary);
      if (copied) {
        showStatus(copy.shareCopied);
      } else {
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
