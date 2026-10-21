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

    function formatSignedMoney(value) {
      const sign = value > 0 ? '+' : value < 0 ? '−' : '';
      return `${sign}${formatMoney(Math.abs(value))} ${sarLabel}`;
    }

    function formatSignedPercent(value) {
      const sign = value > 0 ? '+' : value < 0 ? '−' : '';
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
