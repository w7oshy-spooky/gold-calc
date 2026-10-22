(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldTranslations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COPY = {
    ar: {
      needPrice: 'أدخل سعرًا صالحًا أو اختر «مباشر» لجلب السعر الحالي.',
      liveLoading: 'جاري تحديث سعر الذهب…',
      liveReady: 'السعر المباشر متصل',
      liveStale: 'السعر وصل من المصدر ولكنه متأخر قليلًا.',
      liveCached: 'تعذر التحديث الآن · يتم استخدام آخر سعر محفوظ مؤقتًا.',
      liveUnavailable: 'تعذر جلب السعر المباشر ولا يوجد سعر محفوظ حديث. أدخل السعر يدويًا.',
      lastUpdated: 'آخر تحديث',
      source: 'المصدر',
      units: { ounceUsd: '$/أونصة', ounceSar: 'ر.س/أونصة', gramSar: 'ر.س/جرام' },
      shareLabels: {
        title: 'حاسبة الذهب',
        buy: 'شراء',
        sell: 'بيع',
        weight: 'الوزن (جرام)',
        karat: 'العيار',
        gramPrice: 'سعر الجرام للعيار المختار',
        price24k: 'سعر جرام 24 قيراط',
        disclaimer: 'تقدير إرشادي — قد يختلف سعر التنفيذ الفعلي لدى المحل.',
      },
      shareNeedsPrice: 'أدخل سعرًا صالحًا أولًا لمشاركة الملخص.',
      shareCopied: 'تم نسخ الملخص ✓',
      shareFailed: 'تعذر النسخ على هذا المتصفح.',
      resetDone: 'تمت إعادة الضبط.',
      invoiceBuy: 'شراء',
      invoiceSell: 'بيع',
      invoiceTitle: 'الفاتورة',
      invoiceGramUnit: 'ج',
      invoiceKarat: 'عيار',
      invoiceRemove: 'حذف',
      invoiceAdded: 'تمت الإضافة للفاتورة ✓',
      invoiceNeedsWeight: 'أدخل وزنًا أكبر من صفر قبل الإضافة.',
      invoiceFull: 'وصلت الفاتورة إلى الحد الأقصى من القطع.',
      invoiceCleared: 'تم مسح الفاتورة.',
      invoiceNetPay: 'الصافي للدفع',
      invoiceNetReceive: 'الصافي للاستلام',
      liveOfflinePrefill: 'تعذر جلب السعر المباشر. تمت تعبئة آخر سعر معروف ({time}) — تحقق منه أو عدّله.',
      buyLabels: { final: 'الإجمالي للدفع', primary: 'الذهب', secondary: 'المصنعية', vat: 'الضريبة' },
      sellLabels: { final: 'ستستلم', primary: 'القيمة الخام', secondary: 'الخصم' },
    },
    en: {
      needPrice: 'Enter a valid price or choose Live to fetch the current price.',
      liveLoading: 'Updating live gold price…',
      liveReady: 'Live price connected',
      liveStale: 'The provider returned a delayed quote.',
      liveCached: 'Live refresh failed · using the most recent cached quote temporarily.',
      liveUnavailable: 'Live pricing is unavailable and no recent quote exists. Enter the price manually.',
      lastUpdated: 'Last updated',
      source: 'Source',
      units: { ounceUsd: '$/oz', ounceSar: 'SAR/oz', gramSar: 'SAR/g' },
      shareLabels: {
        title: 'Gold Calculator',
        buy: 'Buy',
        sell: 'Sell',
        weight: 'Weight (g)',
        karat: 'Karat',
        gramPrice: 'Gram price for selected karat',
        price24k: '24K gram price',
        disclaimer: 'Indicative estimate — the actual shop price may differ.',
      },
      shareNeedsPrice: 'Enter a valid price first to share the summary.',
      shareCopied: 'Summary copied ✓',
      shareFailed: 'Copying is not available in this browser.',
      resetDone: 'Reset.',
      invoiceBuy: 'Buy',
      invoiceSell: 'Sell',
      invoiceTitle: 'Invoice',
      invoiceGramUnit: 'g',
      invoiceKarat: 'Karat',
      invoiceRemove: 'Remove',
      invoiceAdded: 'Added to the invoice ✓',
      invoiceNeedsWeight: 'Enter a weight above zero before adding.',
      invoiceFull: 'The invoice has reached the maximum number of pieces.',
      invoiceCleared: 'Invoice cleared.',
      invoiceNetPay: 'Net to pay',
      invoiceNetReceive: 'Net to receive',
      liveOfflinePrefill: 'Live pricing is unavailable. The last known price ({time}) was filled in — check or edit it.',
      buyLabels: { final: 'Total to pay', primary: 'Gold', secondary: 'Workmanship', vat: 'VAT' },
      sellLabels: { final: 'You receive', primary: 'Raw value', secondary: 'Deduction' },
    },
  };

  function getCopy(locale) {
    return COPY[locale === 'ar' ? 'ar' : 'en'];
  }

  return { getCopy };
});
