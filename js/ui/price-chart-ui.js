(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldPriceChartUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Illustrative price movement anchored on the current 24K gram price.
  // `stepMinutes` is the time covered by one point; `volatility` the per-step swing.
  const RANGES = [
    { id: '1D', points: 48, volatility: 0.0016, stepMinutes: 30 },
    { id: '1W', points: 56, volatility: 0.0045, stepMinutes: 180 },
    { id: '1M', points: 60, volatility: 0.008, stepMinutes: 720 },
    { id: '1Y', points: 72, volatility: 0.02, stepMinutes: 5040 },
  ];

  const VIEW_WIDTH = 600;
  const VIEW_HEIGHT = 180;

  // Deterministic, so the shape does not jump around between renders; only its scale follows the price.
  function buildSeries(endPrice, range, seed) {
    let state = seed;
    const random = () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };
    const series = [endPrice];
    for (let i = 1; i < range.points; i += 1) {
      series.unshift(series[0] * (1 + (random() - 0.5) * 2 * range.volatility));
    }
    return series;
  }

  function buildPaths(series) {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const pad = (max - min) * 0.12 || 1;
    const x = (index) => (index / (series.length - 1)) * VIEW_WIDTH;
    const y = (value) => 170 - ((value - (min - pad)) / (max - min + 2 * pad)) * 160;
    const line = series
      .map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
      .join(' ');
    return {
      line,
      area: `${line} L${VIEW_WIDTH} ${VIEW_HEIGHT} L0 ${VIEW_HEIGHT} Z`,
      x,
      y,
    };
  }

  function summarize(series, index) {
    const change = series[index] - series[0];
    return { change, percent: (change / series[0]) * 100 };
  }

  function createPriceChartUI({ document, locale, formatting, now = () => new Date() }) {
    const requireElement = (id) => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Missing required price chart element #${id}`);
      return element;
    };

    const elements = {
      price: requireElement('chartPrice'),
      change: requireElement('chartChange'),
      svg: requireElement('chartSvg'),
      area: requireElement('chartArea'),
      line: requireElement('chartLine'),
      cursor: requireElement('chartCursor'),
      dot: requireElement('chartDot'),
      firstLabel: requireElement('chartFirstLabel'),
      lastLabel: requireElement('chartLastLabel'),
    };
    const rangeButtons = Array.from(document.querySelectorAll('[data-chart-range]'));

    let rangeIndex = 0;
    let hoverIndex = null;
    let price = 0;
    let lastRendered = null;

    function labelFor(range, series, index) {
      const date = new Date(now().getTime() - (series.length - 1 - index) * range.stepMinutes * 60000);
      if (range.id === '1D') {
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: range.id === '1Y' ? '2-digit' : undefined,
      });
    }

    function renderEmpty() {
      elements.price.textContent = '—';
      elements.change.textContent = '';
      elements.change.removeAttribute('data-trend');
      elements.area.setAttribute('d', '');
      elements.line.setAttribute('d', '');
      elements.cursor.setAttribute('visibility', 'hidden');
      elements.dot.hidden = true;
      elements.firstLabel.textContent = '';
      elements.lastLabel.textContent = '';
    }

    function draw() {
      if (!(price > 0)) {
        renderEmpty();
        return;
      }
      const range = RANGES[rangeIndex];
      const series = buildSeries(price, range, 7 + rangeIndex * 13);
      const paths = buildPaths(series);
      const active = hoverIndex == null ? series.length - 1 : hoverIndex;
      const { change, percent } = summarize(series, active);
      const arrow = change >= 0 ? '▲ +' : '▼ −';
      const percentSign = percent >= 0 ? '+' : '−';

      elements.price.textContent = formatting.formatMoney(series[active]);
      elements.change.textContent = `${arrow}${formatting.formatMoney(Math.abs(change))} (${percentSign}${Math.abs(percent).toFixed(2)}%)`;
      elements.change.dataset.trend = change >= 0 ? 'up' : 'down';
      elements.area.setAttribute('d', paths.area);
      elements.line.setAttribute('d', paths.line);

      const cursorX = paths.x(active);
      elements.cursor.setAttribute('x1', cursorX);
      elements.cursor.setAttribute('x2', cursorX);
      elements.cursor.setAttribute('visibility', 'visible');
      elements.dot.hidden = false;
      elements.dot.style.left = `${(cursorX / VIEW_WIDTH) * 100}%`;
      elements.dot.style.top = `${(paths.y(series[active]) / VIEW_HEIGHT) * 100}%`;

      elements.firstLabel.textContent = labelFor(range, series, 0);
      elements.lastLabel.textContent = labelFor(range, series, active);
      rangeButtons.forEach((button, index) => {
        button.setAttribute('aria-pressed', String(index === rangeIndex));
        button.classList.toggle('active', index === rangeIndex);
      });
    }

    function pointFromEvent(event) {
      const rect = elements.svg.getBoundingClientRect();
      if (!rect.width) return null;
      const clientX = event.touches && event.touches[0] ? event.touches[0].clientX : event.clientX;
      const range = RANGES[rangeIndex];
      const ratio = (clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(range.points - 1, Math.round(ratio * (range.points - 1))));
    }

    function onMove(event) {
      const index = pointFromEvent(event);
      if (index == null || index === hoverIndex) return;
      hoverIndex = index;
      draw();
    }

    function onLeave() {
      if (hoverIndex == null) return;
      hoverIndex = null;
      draw();
    }

    elements.svg.addEventListener('mousemove', onMove);
    elements.svg.addEventListener('touchmove', onMove, { passive: true });
    elements.svg.addEventListener('mouseleave', onLeave);
    elements.svg.addEventListener('touchend', onLeave);
    rangeButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        rangeIndex = index;
        hoverIndex = null;
        draw();
      });
    });

    function render(price24k) {
      const next = Number(price24k) > 0 ? Number(price24k) : 0;
      // calculate() runs on every keystroke; the chart only depends on the market price.
      if (next === lastRendered) return;
      lastRendered = next;
      price = next;
      draw();
    }

    return { render };
  }

  return { createPriceChartUI, buildSeries, buildPaths, summarize, RANGES };
});
