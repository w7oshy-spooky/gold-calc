(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldCardCanvasGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CARD_WIDTH = 1080;
  const CARD_HEIGHT = 1350;

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function formatVal(num) {
    return Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function generateCardBlob({
    audit = null,
    advice = null,
    result = null,
    invoice = null,
    copy = {},
    locale = 'ar',
    documentRef = (typeof document !== 'undefined' ? document : null),
  } = {}) {
    if (!documentRef) throw new Error('Document is required for canvas generation');

    if (documentRef.fonts && typeof documentRef.fonts.ready?.then === 'function') {
      try {
        await documentRef.fonts.ready;
      } catch {
        // Continue if fonts check fails
      }
    }

    const canvas = documentRef.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');

    const isRtl = locale === 'ar';
    ctx.direction = isRtl ? 'rtl' : 'ltr';

    // 1. Dark Luxury Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
    bgGradient.addColorStop(0, '#0b0f17');
    bgGradient.addColorStop(0.5, '#111724');
    bgGradient.addColorStop(1, '#090d14');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Gold Outer Frame Accent
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 4;
    roundRect(ctx, 30, 30, CARD_WIDTH - 60, CARD_HEIGHT - 60, 32, false, true);

    // Decorative Top Glow
    const glowGradient = ctx.createRadialGradient(CARD_WIDTH / 2, 70, 10, CARD_WIDTH / 2, 70, 360);
    glowGradient.addColorStop(0, 'rgba(232, 191, 85, 0.22)');
    glowGradient.addColorStop(1, 'rgba(232, 191, 85, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, CARD_WIDTH, 380);

    // 2. Header
    ctx.fillStyle = '#e8bf55';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isRtl ? 'حاسبة الذهب الذكية' : 'Smart Gold Assistant', CARD_WIDTH / 2, 115);

    const dateStr = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    const hasAudit = Boolean(audit && (audit.available || (audit.quotedTotal && audit.quotedTotal > 0)));
    const hasInvoice = Boolean(!hasAudit && invoice && invoice.count > 0);
    const isSell = Boolean(!hasAudit && !hasInvoice && result && result.mode === 'sell');

    let subtitle = '';
    if (hasAudit) {
      subtitle = isRtl ? `تقرير فحص عرض المحل وتفكيك المصنعية · ${dateStr}` : `Store Quote Inspection & Labor Breakdown · ${dateStr}`;
    } else if (hasInvoice) {
      subtitle = isRtl ? `فاتورة الذهب المجمعة (${invoice.count} قطع) · ${dateStr}` : `Consolidated Invoice (${invoice.count} pieces) · ${dateStr}`;
    } else if (isSell) {
      subtitle = isRtl ? `حسبة بيع الذهب (سعر الكاش الفعلي للمحل) · ${dateStr}` : `Gold Sale Valuation (Actual Cash Payout) · ${dateStr}`;
    } else {
      subtitle = isRtl ? `حسبة شراء الذهب (الذهب والمصنعية والضريبة) · ${dateStr}` : `Gold Purchase Cost Breakdown · ${dateStr}`;
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px sans-serif';
    ctx.fillText(subtitle, CARD_WIDTH / 2, 165);

    // 3. Main Hero Card
    ctx.fillStyle = '#17202f';
    ctx.strokeStyle = '#2d3a4f';
    ctx.lineWidth = 2;
    roundRect(ctx, 70, 215, CARD_WIDTH - 140, 205, 24, true, true);

    const colWidth = (CARD_WIDTH - 140) / 3;

    if (hasAudit) {
      // Weight
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isRtl ? 'الوزن' : 'Weight', 70 + colWidth * 0.5, 270);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 46px sans-serif';
      ctx.fillText(`${audit.weight || 0} ${isRtl ? 'جم' : 'g'}`, 70 + colWidth * 0.5, 345);

      // Karat
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isRtl ? 'العيار' : 'Karat', 70 + colWidth * 1.5, 270);
      ctx.fillStyle = '#e8bf55';
      ctx.font = 'bold 46px sans-serif';
      ctx.fillText(`${audit.karat || 21}K`, 70 + colWidth * 1.5, 345);

      // Quoted Total
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isRtl ? 'سعر المعروض' : 'Quoted Total', 70 + colWidth * 2.5, 270);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText(`${Math.round(audit.quotedTotal || 0).toLocaleString()} ${isRtl ? 'ر.س' : 'SAR'}`, 70 + colWidth * 2.5, 345);
    } else if (hasInvoice) {
      // Piece Count
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isRtl ? 'عدد القطع' : 'Pieces', 70 + colWidth * 0.5, 270);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 46px sans-serif';
      ctx.fillText(`${invoice.count || 0}`, 70 + colWidth * 0.5, 345);

      // Action type
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isRtl ? 'نوع المعاملة' : 'Type', 70 + colWidth * 1.5, 270);
      ctx.fillStyle = '#e8bf55';
      ctx.font = 'bold 38px sans-serif';
      const typeStr = invoice.net >= 0 ? (isRtl ? 'دفع للمحل' : 'To Pay') : (isRtl ? 'استلام كاش' : 'To Receive');
      ctx.fillText(typeStr, 70 + colWidth * 1.5, 345);

      // Net Amount
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isRtl ? 'صافي الحسبة' : 'Net Total', 70 + colWidth * 2.5, 270);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText(`${Math.round(Math.abs(invoice.net || 0)).toLocaleString()} ${isRtl ? 'ر.س' : 'SAR'}`, 70 + colWidth * 2.5, 345);
    } else {
      const activeWeight = result ? (result.weight || 0) : 0;
      const activeKarat = result ? (result.karat || 21) : 21;
      const activeTotal = result ? (result.total || 0) : 0;

      // Weight
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isRtl ? 'الوزن' : 'Weight', 70 + colWidth * 0.5, 270);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 46px sans-serif';
      ctx.fillText(`${activeWeight} ${isRtl ? 'جم' : 'g'}`, 70 + colWidth * 0.5, 345);

      // Karat
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isRtl ? 'العيار' : 'Karat', 70 + colWidth * 1.5, 270);
      ctx.fillStyle = '#e8bf55';
      ctx.font = 'bold 46px sans-serif';
      ctx.fillText(`${activeKarat}K`, 70 + colWidth * 1.5, 345);

      // Total
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText(isSell ? (isRtl ? 'كاش البيع' : 'Payout') : (isRtl ? 'الإجمالي' : 'Total'), 70 + colWidth * 2.5, 270);
      ctx.fillStyle = isSell ? '#34d399' : '#38bdf8';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText(`${Math.round(activeTotal).toLocaleString()} ${isRtl ? 'ر.س' : 'SAR'}`, 70 + colWidth * 2.5, 345);
    }

    // 4. Breakdown Section
    ctx.fillStyle = '#141c28';
    ctx.strokeStyle = '#273449';
    roundRect(ctx, 70, 455, CARD_WIDTH - 140, 360, 24, true, true);

    ctx.fillStyle = '#e8bf55';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = isRtl ? 'right' : 'left';
    const breakdownTitleX = isRtl ? CARD_WIDTH - 110 : 110;

    let breakdownTitle = '';
    let rows = [];

    if (hasAudit) {
      breakdownTitle = isRtl ? '⚡ تفكيك عرض التاجر الحقيقي' : '⚡ Real Cost Deconstruction';
      rows = [
        {
          label: isRtl ? 'قيمة الذهب الصافي (سعر البورصة):' : 'Raw Gold Value (Spot Price):',
          val: `${formatVal(audit.rawMetalCost)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#e2e8f0',
        },
        {
          label: isRtl ? 'ضريبة القيمة المضافة (15% ZATCA):' : 'VAT (15% ZATCA):',
          val: `${formatVal(audit.vat)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#f87171',
        },
        {
          label: isRtl ? 'إجمالي ربح التاجر والمصنعية:' : 'Total Workmanship & Merchant Profit:',
          val: `${formatVal(audit.laborCost)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#e2e8f0',
        },
        {
          label: isRtl ? 'المصنعية لكل جرام:' : 'Workmanship Per Gram:',
          val: `${formatVal(audit.laborPerGram)} ${isRtl ? 'ر.س / جرام' : 'SAR / g'}`,
          color: '#fbbf24',
          bold: true,
        },
      ];
    } else if (hasInvoice) {
      breakdownTitle = isRtl ? '📋 تفاصيل بنود الفاتورة' : '📋 Invoice Items Summary';
      const lines = invoice.lines || [];
      const showLines = lines.slice(0, 3);
      rows = showLines.map((ln, idx) => ({
        label: `${idx + 1}. ${ln.mode === 'sell' ? (isRtl ? 'بيع' : 'Sell') : (isRtl ? 'شراء' : 'Buy')} (${ln.weight}g · ${ln.karat}K):`,
        val: `${formatVal(ln.total)} ${isRtl ? 'ر.س' : 'SAR'}`,
        color: '#e2e8f0',
      }));
      rows.push({
        label: isRtl ? 'صافي الحسبة الإجمالية:' : 'Total Net Amount:',
        val: `${formatVal(Math.abs(invoice.net || 0))} ${isRtl ? 'ر.س' : 'SAR'}`,
        color: '#34d399',
        bold: true,
      });
    } else if (isSell) {
      breakdownTitle = isRtl ? '💵 تفاصيل تسعير بيع الذهب المستعمل' : '💵 Used Gold Sale Breakdown';
      rows = [
        {
          label: isRtl ? `سعر جرام الذهب (${result.karat}K) في السوق:` : `Gold Spot Price (${result.karat}K):`,
          val: `${formatVal(result.gramPrice)} ${isRtl ? 'ر.س / جم' : 'SAR / g'}`,
          color: '#e2e8f0',
        },
        {
          label: isRtl ? 'قيمة الذهب الصافي بدون خصم:' : 'Raw Gold Value:',
          val: `${formatVal(result.rawMetalValue)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#e2e8f0',
        },
        {
          label: isRtl ? `خصم المحل التجاري (${result.deductionRate}%):` : `Store Deduction Rate (${result.deductionRate}%):`,
          val: `-${formatVal(result.deductionValue)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#f87171',
        },
        {
          label: isRtl ? 'صافي المبلغ النقدي المستحق لك:' : 'Actual Cash Payout to Receive:',
          val: `${formatVal(result.total)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#34d399',
          bold: true,
        },
      ];
    } else {
      const activeRes = result || {};
      breakdownTitle = isRtl ? '🏷️ تفاصيل تكلفة شراء القطعة' : '🏷️ Gold Purchase Breakdown';
      rows = [
        {
          label: isRtl ? 'قيمة الذهب الخام (سعر البورصة):' : 'Raw Gold Value:',
          val: `${formatVal(activeRes.goldCost)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#e2e8f0',
        },
        {
          label: isRtl ? 'أجرة المصنعية وربح الصائغ:' : 'Workmanship & Making Charge:',
          val: `${formatVal(activeRes.laborCost)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#fbbf24',
        },
        {
          label: isRtl ? `ضريبة القيمة المضافة (${activeRes.taxRate || 15}% ZATCA):` : `VAT (${activeRes.taxRate || 15}%):`,
          val: `${formatVal(activeRes.vat)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#f87171',
        },
        {
          label: isRtl ? 'الإجمالي النهائي المطلوب للدفع:' : 'Final Total to Pay:',
          val: `${formatVal(activeRes.total)} ${isRtl ? 'ر.س' : 'SAR'}`,
          color: '#38bdf8',
          bold: true,
        },
      ];
    }

    ctx.fillText(breakdownTitle, breakdownTitleX, 510);

    let rowY = 575;
    rows.forEach((r) => {
      ctx.font = r.bold ? 'bold 28px sans-serif' : '26px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = isRtl ? 'right' : 'left';
      ctx.fillText(r.label, isRtl ? CARD_WIDTH - 110 : 110, rowY);

      ctx.fillStyle = r.color;
      ctx.textAlign = isRtl ? 'left' : 'right';
      ctx.fillText(r.val, isRtl ? 110 : CARD_WIDTH - 110, rowY);
      rowY += 60;
    });

    // 5. Verdict Badge Banner
    let badgeColor = '#10b981';
    let badgeBg = 'rgba(16, 185, 129, 0.16)';
    let badgeText = '';

    if (hasAudit) {
      const labor = audit.laborPerGram || 0;
      if (labor > 45) {
        badgeColor = '#ef4444';
        badgeBg = 'rgba(239, 68, 68, 0.16)';
        badgeText = isRtl ? '🔴 المصنعية مرتفعة وتحتاج مكاسرة' : '🔴 High Workmanship - Negotiate Down';
      } else if (labor > 25) {
        badgeColor = '#f59e0b';
        badgeBg = 'rgba(245, 158, 11, 0.16)';
        badgeText = isRtl ? '🟡 سعر عادل وضمن متوسط السوق' : '🟡 Fair Market Price';
      } else {
        badgeText = isRtl ? '🟢 سعر لقطة وممتاز (مصنعية تنافسية)' : '🟢 Great Deal (Competitive Labor)';
      }
    } else if (hasInvoice) {
      badgeColor = '#e8bf55';
      badgeBg = 'rgba(232, 191, 85, 0.16)';
      badgeText = isRtl ? '🧾 فاتورة تفصيلية معتمدة ومتوافقة مع السوق' : '🧾 Itemized Certified Invoice Calculation';
    } else if (isSell) {
      badgeColor = '#34d399';
      badgeBg = 'rgba(52, 211, 153, 0.16)';
      badgeText = isRtl ? '🟢 تقييم بيع عادل وفق سعر البورصة الفوري' : '🟢 Fair Cash Valuation Based on Spot Gold';
    } else {
      badgeColor = '#38bdf8';
      badgeBg = 'rgba(56, 189, 248, 0.16)';
      badgeText = isRtl ? '🟡 حسبة رسمية شاملة الضريبة وأجرة الصياغة' : '🟡 Certified Purchase Breakdown with VAT & Labor';
    }

    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 2;
    roundRect(ctx, 70, 855, CARD_WIDTH - 140, 95, 20, true, true);

    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, CARD_WIDTH / 2, 915);

    // 6. Guidance / Advice Card
    ctx.fillStyle = '#141c28';
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    roundRect(ctx, 70, 980, CARD_WIDTH - 140, 230, 24, true, true);

    if (advice && advice.available) {
      ctx.fillStyle = '#e8bf55';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = isRtl ? 'right' : 'left';
      ctx.fillText(isRtl ? '💡 نصيحة التفاوض ونطاق السعر العادل:' : '💡 Negotiation Advice & Fair Price:', isRtl ? CARD_WIDTH - 110 : 110, 1035);

      const minFair = Math.round(advice.minFairPrice || 0);
      const maxFair = Math.round(advice.maxFairPrice || 0);
      const savings = Math.round(advice.potentialSavings || 0);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '24px sans-serif';
      const rangeText = isRtl
        ? `السعر العادل المفترض للقطعة: بين ${minFair} إلى ${maxFair} ر.س`
        : `Fair Estimated Range: ${minFair} to ${maxFair} SAR`;
      ctx.fillText(rangeText, isRtl ? CARD_WIDTH - 110 : 110, 1090);

      if (savings > 0) {
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 26px sans-serif';
        const savingsText = isRtl
          ? `🎯 يمكنك توفير حوالي ${savings} ر.س بالمكاسرة الحازمة!`
          : `🎯 You can save approx ${savings} SAR by negotiating!`;
        ctx.fillText(savingsText, isRtl ? CARD_WIDTH - 110 : 110, 1145);
      }
    } else {
      ctx.fillStyle = '#e8bf55';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = isRtl ? 'right' : 'left';
      const tipHeader = isSell
        ? (isRtl ? '💡 نصيحة هامة عند بيع الذهب:' : '💡 Important Advice for Selling Gold:')
        : (isRtl ? '💡 نصيحة ذكية عند شراء الذهب:' : '💡 Smart Tips for Buying Gold:');
      ctx.fillText(tipHeader, isRtl ? CARD_WIDTH - 110 : 110, 1035);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '22px sans-serif';
      if (isSell) {
        const line1 = isRtl
          ? '• تأكد من وزن القطعة أمامك بدقة، واعلم أن المصنعية والفصوص لا تُسترد عند البيع.'
          : '• Always verify item weight on the scale; labor and gems are not refunded on sale.';
        const line2 = isRtl
          ? '• راقب سعر الذهب الفوري قبل الذهاب للمحل لتحصل على أعلى سعر كاش ممكن.'
          : '• Check spot price before visiting shops to secure the highest cash payout.';
        ctx.fillText(line1, isRtl ? CARD_WIDTH - 110 : 110, 1090);
        ctx.fillText(line2, isRtl ? CARD_WIDTH - 110 : 110, 1145);
      } else {
        const line1 = isRtl
          ? '• قارن سعر المصنعية للجرام بين عدة متاجر، واطلب دائماً فاتورة ضريبية رسمية.'
          : '• Compare workmanship per gram across stores and request an official VAT invoice.';
        const line2 = isRtl
          ? '• إذا كانت القطعة تحتوي فصوصاً غير ثمينة، فاوض على خصم وزنها من الحساب.'
          : '• If the piece has decorative stones, negotiate for their weight deduction.';
        ctx.fillText(line1, isRtl ? CARD_WIDTH - 110 : 110, 1090);
        ctx.fillText(line2, isRtl ? CARD_WIDTH - 110 : 110, 1145);
      }
    }

    // 7. Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isRtl ? 'تم الفحص بواسطة حاسبة الذهب الذكية للسوق السعودي' : 'Inspected by Smart Saudi Gold Assistant', CARD_WIDTH / 2, 1280);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas blob generation failed'));
      }, 'image/png');
    });
  }

  async function shareOrDownloadCard({
    blob,
    filename = 'gold-card.png',
    title = 'حاسبة الذهب',
    navigatorRef = (typeof navigator !== 'undefined' ? navigator : null),
    windowRef = (typeof window !== 'undefined' ? window : null),
    nativeFile = (typeof globalThis !== 'undefined' ? globalThis.GoldNativeFile : null),
    capacitor = (typeof globalThis !== 'undefined' ? globalThis.Capacitor : null),
  } = {}) {
    if (!blob) throw new Error('Blob is required for sharing');

    // 0. Inside the Capacitor app: write the image and open the system share sheet.
    if (nativeFile && nativeFile.getNativePlugins(capacitor)) {
      try {
        const result = await nativeFile.saveFile({ filename, blob, mimeType: 'image/png', title, capacitor });
        return result.cancelled ? { shared: false, method: 'cancelled' } : { shared: true, method: 'native_share' };
      } catch (_error) {
        // Fall through to the web options below.
      }
    }

    const file = new File([blob], filename, { type: 'image/png' });

    // 1. Try Web Share API with file ONLY (DO NOT pass text parameter: WhatsApp/Android drops image if text is present!)
    if (navigatorRef && typeof navigatorRef.canShare === 'function' && navigatorRef.canShare({ files: [file] })) {
      try {
        await navigatorRef.share({
          title,
          files: [file],
        });
        return { shared: true, method: 'web_share' };
      } catch (err) {
        if (err.name === 'AbortError') return { shared: false, method: 'cancelled' };
      }
    }

    // 2. Fallback: Trigger direct download
    if (windowRef && windowRef.document) {
      const url = URL.createObjectURL(blob);
      const a = windowRef.document.createElement('a');
      a.href = url;
      a.download = filename;
      windowRef.document.body.appendChild(a);
      a.click();
      windowRef.document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { shared: true, method: 'download' };
    }

    return { shared: false, method: 'unsupported' };
  }

  return {
    CARD_WIDTH,
    CARD_HEIGHT,
    generateCardBlob,
    shareOrDownloadCard,
  };
});
