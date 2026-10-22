(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldFormatting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createFormatting(locale = 'en') {
    const safeLocale = locale === 'ar' ? 'ar' : 'en';
    const sarLabel = safeLocale === 'ar' ? 'ر.س' : 'SAR';

    function formatMoney(value) {
      return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    function formatInput(value, decimals = 2) {
      if (!Number.isFinite(value) || value <= 0) return '';
      return value.toFixed(decimals);
    }

    function formatSar(value) {
      return `${formatMoney(value)} ${sarLabel}`;
    }

    // The sign follows the rounded value, so a tiny difference shows as 0.00 rather than +0.00.
    function signFor(value) {
      const rounded = Math.round(value * 100) / 100;
      return rounded > 0 ? '+' : rounded < 0 ? '−' : '';
    }

    function formatSignedMoney(value) {
      const sign = signFor(value);
      return `${sign}${formatMoney(Math.abs(value))} ${sarLabel}`;
    }

    function formatSignedPercent(value) {
      const sign = signFor(value);
      return `${sign}${Math.abs(value).toFixed(2)}%`;
    }

    function sourceDisplayName(source) {
      if (source === 'gold-api') return 'Gold API';
      if (source === 'xaus') return 'XAUS';
      return source || '—';
    }

    function formatLiveTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      // Gregorian calendar and Latin digits keep timestamps consistent with the money figures.
      return new Intl.DateTimeFormat(safeLocale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    }

    return {
      formatMoney,
      formatInput,
      formatSar,
      formatSignedMoney,
      formatSignedPercent,
      sourceDisplayName,
      formatLiveTime,
    };
  }

  return { createFormatting };
});
