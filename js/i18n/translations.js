(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldTranslations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COPY = {
    ar: {
      liveMode: 'يتم جلب سعر الأوقية الحي تلقائيًا ثم تحويله إلى سعر جرام 24 قيراط بالريال السعودي.',
      ounceMode: 'أدخل سعر الأوقية بالدولار، وسيتم تحويله إلى الريال وأسعار الجرام تلقائيًا.',
      ounceSarMode: 'أدخل سعر الأوقية بالريال السعودي، وسيتم حساب السعر المكافئ بالدولار وأسعار الجرام.',
      gramSarMode: 'أدخل سعر جرام الذهب الخام بالريال وحدد عياره لحساب سعر الأوقية والقيم المكافئة.',
      manualMode: 'أدخل سعر جرام 24 يدويًا قبل المصنعية والضريبة.',
      needPrice: 'أدخل سعرًا صالحًا أو اختر LIVE لجلب السعر الحالي.',
      liveLoading: 'جاري تحديث سعر الذهب…',
      liveReady: 'LIVE · السعر الحي متصل',
      liveStale: 'السعر وصل من المصدر ولكنه متأخر قليلًا.',
      liveCached: 'تعذر التحديث الآن · يتم استخدام آخر سعر محفوظ مؤقتًا.',
      liveUnavailable: 'تعذر جلب السعر الحي ولا يوجد سعر محفوظ حديث. تم التحويل إلى إدخال الأوقية اليدوي.',
      refresh: 'تحديث',
      lastUpdated: 'آخر تحديث',
      source: 'المصدر',
      buyHelp: 'وضع الشراء يضيف المصنعية والربح الاختياري والضريبة التي تحددها.',
      sellHelp: 'وضع البيع يعتمد قيمة الذهب الخام ويطرح فقط نسبة خصم المشتري التي تدخلها.',
      buyQuoteLabel: 'السعر الإجمالي المعروض من المحل (ر.س)',
      sellQuoteLabel: 'المبلغ الإجمالي الذي عرضه المشتري أو المحل (ر.س)',
      comparePrompt: 'أدخل عرض المحل لبدء المقارنة.',
      statuses: {
        close: 'العرض قريب من السعر المرجعي (ضمن ±2%).',
        moderate_high: 'العرض أعلى من المرجع قليلًا (بين 2% و5%).',
        high: 'العرض أعلى من المرجع بأكثر من 5%.',
        below_reference: 'العرض أقل من السعر المرجعي.',
        moderate_low: 'عرض الشراء أقل من المرجع قليلًا (بين 2% و5%).',
        low: 'عرض الشراء أقل من المرجع بأكثر من 5%.',
        above_reference: 'عرض الشراء أعلى من السعر المرجعي.',
      },
      buyLabels: {
        primary: 'تكلفة الذهب',
        secondary: 'مصنعية + ربح',
        subtotal: 'قبل الضريبة',
        final: 'السعر النهائي للدفع',
      },
      sellLabels: {
        primary: 'قيمة الذهب الخام',
        secondary: 'خصم المشتري',
        subtotal: 'صافي المبلغ المرجعي',
        final: 'المبلغ المرجعي المتوقع',
      },
      note: '<strong class="text-gray-700">ملاحظة:</strong> سعر LIVE سعر فوري إرشادي للذهب الخام XAU/USD ويُحوّل إلى الريال السعودي. النتائج تقديرية، وقد يختلف سعر التنفيذ الفعلي لدى المحلات بسبب فرق الشراء والبيع والمصنعية والأحجار والعروض والمعاملة الضريبية.',
    },
    en: {
      liveMode: 'The live troy-ounce price is fetched automatically and converted to the 24K gram price in Saudi riyals.',
      ounceMode: 'Enter the ounce price in USD to calculate SAR ounce and gram equivalents automatically.',
      ounceSarMode: 'Enter the ounce price in SAR to calculate its USD and gram equivalents.',
      gramSarMode: 'Enter a raw gold gram price in SAR and choose its karat to calculate ounce and equivalent prices.',
      manualMode: 'Enter the 24K gram price manually before workmanship and VAT.',
      needPrice: 'Enter a valid price or choose LIVE to fetch the current price.',
      liveLoading: 'Updating live gold price…',
      liveReady: 'LIVE · price feed connected',
      liveStale: 'The provider returned a delayed quote.',
      liveCached: 'Live refresh failed · using the most recent cached quote temporarily.',
      liveUnavailable: 'Live pricing is unavailable and no recent cached quote exists. Switched to manual ounce entry.',
      refresh: 'Refresh',
      lastUpdated: 'Last updated',
      source: 'Source',
      buyHelp: 'Buy mode adds workmanship, optional extra margin and the VAT rate you select.',
      sellHelp: 'Sell mode uses raw metal value and subtracts only the buyer deduction you enter.',
      buyQuoteLabel: 'Shop quoted total (SAR)',
      sellQuoteLabel: 'Buyer or shop offered total (SAR)',
      comparePrompt: 'Enter the quoted amount to start the comparison.',
      statuses: {
        close: 'The quote is close to the reference (within ±2%).',
        moderate_high: 'The quote is moderately above the reference (2% to 5%).',
        high: 'The quote is more than 5% above the reference.',
        below_reference: 'The quote is below the reference amount.',
        moderate_low: 'The buyback offer is moderately below the reference (2% to 5%).',
        low: 'The buyback offer is more than 5% below the reference.',
        above_reference: 'The buyback offer is above the reference amount.',
      },
      buyLabels: {
        primary: 'Gold cost',
        secondary: 'Workmanship + margin',
        subtotal: 'Before VAT',
        final: 'Final amount',
      },
      sellLabels: {
        primary: 'Raw metal value',
        secondary: 'Buyer deduction',
        subtotal: 'Reference net payout',
        final: 'Estimated reference payout',
      },
      note: '<strong class="text-gray-700">Note:</strong> LIVE uses an indicative XAU/USD raw-gold spot quote converted to Saudi riyals. Results are estimates; actual shop execution can differ because of bid/ask spreads, workmanship, stones, promotions and tax treatment.',
    },
  };

  function getCopy(locale) {
    return COPY[locale === 'ar' ? 'ar' : 'en'];
  }

  return { getCopy };
});
