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

  async function generateCardBlob({
    audit = {},
    advice = {},
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
    bgGradient.addColorStop(0, '#0d1015');
    bgGradient.addColorStop(0.5, '#131822');
    bgGradient.addColorStop(1, '#0a0d11');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Subtle Gold Border Accent
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 4;
    roundRect(ctx, 30, 30, CARD_WIDTH - 60, CARD_HEIGHT - 60, 32, false, true);

    // Decorative Top Glow
    const glowGradient = ctx.createRadialGradient(CARD_WIDTH / 2, 80, 10, CARD_WIDTH / 2, 80, 380);
    glowGradient.addColorStop(0, 'rgba(232, 191, 85, 0.18)');
    glowGradient.addColorStop(1, 'rgba(232, 191, 85, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, CARD_WIDTH, 400);

    // 2. Header
    ctx.fillStyle = '#e8bf55';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isRtl ? 'حاسبة الذهب الذكية' : 'Smart Gold Assistant', CARD_WIDTH / 2, 120);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '26px sans-serif';
    const dateStr = new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    ctx.fillText(isRtl ? `تقرير فحص عرض المحل · ${dateStr}` : `Store Quote Inspection · ${dateStr}`, CARD_WIDTH / 2, 170);

    // 3. Main Piece Hero Card
    ctx.fillStyle = '#181e28';
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 2;
    roundRect(ctx, 70, 220, CARD_WIDTH - 140, 200, 24, true, true);

    // Inside Hero Card: 3 columns (Karat, Weight, Total Quoted)
    const colWidth = (CARD_WIDTH - 140) / 3;

    // Weight
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px sans-serif';
    ctx.fillText(isRtl ? 'الوزن' : 'Weight', 70 + colWidth * 0.5, 275);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(`${audit.weight || 0} ${isRtl ? 'جرام' : 'g'}`, 70 + colWidth * 0.5, 345);

    // Karat
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px sans-serif';
    ctx.fillText(isRtl ? 'العيار' : 'Karat', 70 + colWidth * 1.5, 275);
    ctx.fillStyle = '#e8bf55';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(`${audit.karat || 21}K`, 70 + colWidth * 1.5, 345);

    // Quoted Total
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px sans-serif';
    ctx.fillText(isRtl ? 'السعر المطلوب' : 'Quoted Total', 70 + colWidth * 2.5, 275);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(`${Math.round(audit.quotedTotal || 0).toLocaleString()} ${isRtl ? 'ر.س' : 'SAR'}`, 70 + colWidth * 2.5, 345);

    // 4. Deconstructed Breakdown Section
    ctx.fillStyle = '#151b24';
    ctx.strokeStyle = '#273142';
    roundRect(ctx, 70, 460, CARD_WIDTH - 140, 360, 24, true, true);

    ctx.fillStyle = '#e8bf55';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = isRtl ? 'right' : 'left';
    const breakdownTitleX = isRtl ? CARD_WIDTH - 110 : 110;
    ctx.fillText(isRtl ? '⚡ تفكيك عرض التاجر الحقيقي' : '⚡ Real Cost Deconstruction', breakdownTitleX, 515);

    // 4 metric rows:
    const rows = [
      {
        label: isRtl ? 'قيمة الذهب الصافي (سعر البورصة):' : 'Raw Gold Value (Spot Price):',
        val: `${(audit.rawMetalCost || 0).toFixed(2)} ${isRtl ? 'ر.س' : 'SAR'}`,
        color: '#e2e8f0',
      },
      {
        label: isRtl ? 'ضريبة القيمة المضافة (15% ZATCA):' : 'VAT (15% ZATCA):',
        val: `${(audit.vat || 0).toFixed(2)} ${isRtl ? 'ر.س' : 'SAR'}`,
        color: '#f87171',
      },
      {
        label: isRtl ? 'إجمالي ربح التاجر والمصنعية:' : 'Total Workmanship & Merchant Profit:',
        val: `${(audit.laborCost || 0).toFixed(2)} ${isRtl ? 'ر.س' : 'SAR'}`,
        color: '#e2e8f0',
      },
      {
        label: isRtl ? 'المصنعية لكل جرام:' : 'Workmanship Per Gram:',
        val: `${(audit.laborPerGram || 0).toFixed(2)} ${isRtl ? 'ر.س / جرام' : 'SAR / g'}`,
        color: '#fbbf24',
        bold: true,
      },
    ];

    let rowY = 580;
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
    const labor = audit.laborPerGram || 0;
    let badgeColor = '#10b981'; // Green
    let badgeBg = 'rgba(16, 185, 129, 0.16)';
    let badgeText = isRtl ? '🟢 سعر لقطة وممتاز (مصنعية تنافسية)' : '🟢 Great Deal (Competitive Labor)';

    if (labor > 45) {
      badgeColor = '#ef4444'; // Red
      badgeBg = 'rgba(239, 68, 68, 0.16)';
      badgeText = isRtl ? '🔴 المصنعية مرتفعة وتحتاج مكاسرة' : '🔴 High Workmanship - Negotiate Down';
    } else if (labor > 25) {
      badgeColor = '#f59e0b'; // Amber
      badgeBg = 'rgba(245, 158, 11, 0.16)';
      badgeText = isRtl ? '🟡 سعر عادل وضمن متوسط السوق' : '🟡 Fair Market Price';
    }

    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 2;
    roundRect(ctx, 70, 860, CARD_WIDTH - 140, 100, 20, true, true);

    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, CARD_WIDTH / 2, 924);

    // 6. Negotiation Guidance Card
    if (advice && advice.available) {
      ctx.fillStyle = '#151b24';
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
      ctx.lineWidth = 2;
      roundRect(ctx, 70, 990, CARD_WIDTH - 140, 220, 24, true, true);

      ctx.fillStyle = '#e8bf55';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = isRtl ? 'right' : 'left';
      ctx.fillText(isRtl ? '💡 نصيحة التفاوض ونطاق السعر العادل:' : '💡 Negotiation Advice & Fair Price:', isRtl ? CARD_WIDTH - 110 : 110, 1045);

      const minFair = Math.round(advice.minFairPrice || 0);
      const maxFair = Math.round(advice.maxFairPrice || 0);
      const savings = Math.round(advice.potentialSavings || 0);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '24px sans-serif';
      const rangeText = isRtl
        ? `السعر العادل المفترض للقطعة: بين ${minFair} إلى ${maxFair} ر.س`
        : `Fair Estimated Range: ${minFair} to ${maxFair} SAR`;
      ctx.fillText(rangeText, isRtl ? CARD_WIDTH - 110 : 110, 1100);

      if (savings > 0) {
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 26px sans-serif';
        const savingsText = isRtl
          ? `🎯 يمكنك توفير حوالي ${savings} ر.س بالمكاسرة الحازمة!`
          : `🎯 You can save approx ${savings} SAR by negotiating!`;
        ctx.fillText(savingsText, isRtl ? CARD_WIDTH - 110 : 110, 1155);
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
    filename = 'gold-audit.png',
    title = 'فحص عرض الذهب',
    text = 'تقرير فحص عرض الذهب عبر حاسبة الذهب الذكية',
    navigatorRef = (typeof navigator !== 'undefined' ? navigator : null),
    windowRef = (typeof window !== 'undefined' ? window : null),
  } = {}) {
    if (!blob) throw new Error('Blob is required for sharing');

    const file = new File([blob], filename, { type: 'image/png' });

    // 1. Try Web Share API with file
    if (navigatorRef && typeof navigatorRef.canShare === 'function' && navigatorRef.canShare({ files: [file] })) {
      try {
        await navigatorRef.share({
          title,
          text,
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
