(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldQuickInputParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EASTERN_ARABIC_DIGITS = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };

  function normalizeDigits(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[٠-٩]/g, (ch) => EASTERN_ARABIC_DIGITS[ch] || ch);
  }

  function normalizeSeparators(text) {
    if (!text) return '';
    // First normalize eastern arabic digits to western
    const withWesternDigits = normalizeDigits(text);
    // Replace Arabic decimal mark '٫' with standard period '.'
    let cleaned = withWesternDigits.replace(/٫/g, '.');
    // Handle comma as decimal if surrounded by digits without thousands grouping: e.g. "6,5" -> "6.5"
    cleaned = cleaned.replace(/(\d+)[،,](\d{1,2})(?!\d)/g, '$1.$2');
    // Remove thousands commas e.g. "1,500" or "1،500"
    cleaned = cleaned.replace(/(\d+)[،,](\d{3})/g, '$1$2');
    return cleaned;
  }

  function normalizeText(text) {
    return normalizeSeparators(normalizeDigits(text));
  }

  function parseQuickInput(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') {
      return {
        success: false,
        karat: null,
        weight: null,
        quotedTotal: null,
        hasStones: false,
        rawText: '',
      };
    }

    const rawText = rawInput.trim();
    const normalized = normalizeSeparators(normalizeDigits(rawText));

    let detectedKarat = null;
    let detectedWeight = null;
    let detectedPrice = null;

    // 1. Stones detection
    const stonesPattern = /(?:فصوص|زركون|زيركون|حجر|احجار|أحجار|stones?|zircon)/i;
    const hasStones = stonesPattern.test(normalized);

    // 2. Karat detection: look for 18, 21, 22, 24 with optional 'عيار', 'قيراط', 'k', 'karat'
    // First try explicit karat prefix/suffix
    const explicitKaratMatch = normalized.match(/(?:عيار|قيراط|karat)\s*(18|21|22|24)\b/i)
      || normalized.match(/\b(18|21|22|24)\s*(?:عيار|قيراط|karat|k)\b/i)
      || normalized.match(/\b(18|21|22|24)k\b/i);

    if (explicitKaratMatch) {
      detectedKarat = Number.parseInt(explicitKaratMatch[1], 10);
    }

    // 3. Weight detection: number followed by gram unit or preceded by وزن/وزنه/وزنها/weight
    const explicitWeightMatch = normalized.match(/(?:وزن|وزنه|وزنها|وزن القطعة|weight)\s*(?:هو|:)?\s*(\d+(?:\.\d+)?)\s*(?:جرام|جم|غرام|غم|g|gram|grams)?\b/i)
      || normalized.match(/(\d+(?:\.\d+)?)\s*(?:جرام|جم|غرام|غم|g|gram|grams)\b/i);

    if (explicitWeightMatch) {
      detectedWeight = Number.parseFloat(explicitWeightMatch[1]);
    }

    // 4. Price detection: number followed by currency or preceded by بـ / بسعر / ب / سعر / price / for
    const explicitPriceMatch = normalized.match(/(?:سعر|سعره|سعرها|السعر|price)\s*(?:هو|:)?\s*(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س|رس|sar|sr)?\b/i)
      || normalized.match(/(?:بـ|بسعر|ب|for)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س|رس|sar|sr)?\b/i)
      || normalized.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س|رس|sar|sr)\b/i);

    if (explicitPriceMatch) {
      detectedPrice = Number.parseFloat(explicitPriceMatch[1]);
    }

    // Fallback heuristic if some fields are missing but numbers exist
    if (!detectedKarat) {
      // Standalone 18, 21, 22, 24 if not matching weight or price
      const standaloneKarat = normalized.match(/\b(18|21|22|24)\b/);
      if (standaloneKarat) {
        const val = Number.parseInt(standaloneKarat[1], 10);
        if (val !== detectedWeight && val !== detectedPrice) {
          detectedKarat = val;
        }
      }
    }

    // 5. Piece family detection
    let detectedPieceFamily = null;
    if (/(?:خاتم|خواتم|دبلة|دبله|توينز|حلق|اخراس|أخراس|خرص|تراكي|بريمة|بريمه|شناكل|ring|rings|earring|earrings)/i.test(normalized)) {
      detectedPieceFamily = 'ring_earring';
    } else if (/(?:بناجر|بنجرة|بنجره|غوايش|غويشة|غويشه|أساور|اساور|سوار|اسورة|أسورة|bangle|bangles|bracelet|bracelets)/i.test(normalized)) {
      detectedPieceFamily = 'bangle';
    } else if (/(?:سلسلة|سلسله|سلاسل|عقد|عقود|قلادة|قلاده|شوكر|تشوكر|خلخال|خلاخل|chain|chains|necklace|necklaces)/i.test(normalized)) {
      detectedPieceFamily = 'chain';
    } else if (/(?:طقم|اطقم|أطقم|شبكة|شبكه|كف|كفوف|كرسي جابر|رشرش|هامة|هامه|حزام|set|sets|bridal)/i.test(normalized)) {
      detectedPieceFamily = 'set_bridal';
    } else if (/(?:سبيكة|سبيكه|سبائك|سبايك|جنيه|جنيهات|ليرة|ليره|bullion|bar|bars|coin|coins)/i.test(normalized)) {
      detectedPieceFamily = 'bullion';
    }

    const success = Boolean(detectedKarat || detectedWeight || detectedPrice || detectedPieceFamily);

    return {
      success,
      karat: detectedKarat,
      weight: detectedWeight !== null && Number.isFinite(detectedWeight) && detectedWeight > 0 ? detectedWeight : null,
      quotedTotal: detectedPrice !== null && Number.isFinite(detectedPrice) && detectedPrice > 0 ? detectedPrice : null,
      pieceFamily: detectedPieceFamily,
      hasStones,
      rawText,
    };
  }

  return {
    normalizeDigits,
    normalizeSeparators,
    normalizeText,
    parseQuickInput,
  };
});
