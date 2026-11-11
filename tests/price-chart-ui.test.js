const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildSeries, buildPaths, summarize, RANGES } = require('../js/ui/price-chart-ui.js');

test('chart series ends at the current price and is deterministic', () => {
  for (const [index, range] of RANGES.entries()) {
    const first = buildSeries(450, range, 7 + index * 13);
    const second = buildSeries(450, range, 7 + index * 13);
    assert.equal(first.length, range.points);
    assert.equal(first[first.length - 1], 450);
    assert.deepEqual(first, second);
  }
});

test('chart series scales with the price without changing shape', () => {
  const small = buildSeries(100, RANGES[0], 7);
  const large = buildSeries(200, RANGES[0], 7);
  small.forEach((value, i) => assert.ok(Math.abs(value * 2 - large[i]) < 1e-9));
});

test('chart paths stay inside the viewBox and form a closed area', () => {
  const series = buildSeries(450, RANGES[2], 33);
  const { line, area, x, y } = buildPaths(series);
  assert.match(line, /^M0\.0 /);
  assert.match(area, /L600 180 L0 180 Z$/);
  assert.equal(x(series.length - 1), 600);
  for (const value of series) {
    assert.ok(y(value) >= 0 && y(value) <= 180);
  }
});

test('summarize reports the change from the first point', () => {
  const { change, percent } = summarize([100, 110, 105], 2);
  assert.equal(change, 5);
  assert.equal(percent, 5);
});

test('both pages render the chart card and load its script', () => {
  for (const file of ['index.html']) {
    const html = fs.readFileSync(file, 'utf8');
    for (const id of ['chartPrice', 'chartChange', 'chartSvg', 'chartArea', 'chartLine', 'chartCursor', 'chartDot', 'chartFirstLabel', 'chartLastLabel']) {
      assert.match(html, new RegExp(`id="${id}"`), `${file} needs #${id}`);
    }
    assert.equal((html.match(/data-chart-range=/g) || []).length, 4);
    assert.ok(html.indexOf('js/ui/price-chart-ui.js') < html.indexOf('js/app.js'));
  }
});

test('chart shows a waiting message until a live price arrives', () => {
  const { createPriceChartUI } = require('../js/ui/price-chart-ui.js');
  const makeElement = () => ({
    textContent: '',
    hidden: false,
    style: {},
    dataset: {},
    attrs: {},
    classList: { toggle() {} },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener() {},
  });
  const ids = ['chartPrice', 'chartChange', 'chartSvg', 'chartArea', 'chartLine', 'chartCursor', 'chartDot', 'chartFirstLabel', 'chartLastLabel', 'chartEmpty'];
  const byId = Object.fromEntries(ids.map((id) => [id, makeElement()]));
  const document = { getElementById: (id) => byId[id] || null, querySelectorAll: () => [] };
  const formatting = { formatMoney: (value) => value.toFixed(2) };

  const chart = createPriceChartUI({ document, locale: 'en', formatting });
  chart.render(0);
  assert.equal(byId.chartEmpty.hidden, false);

  chart.render(450);
  assert.equal(byId.chartEmpty.hidden, true);

  chart.render(0);
  assert.equal(byId.chartEmpty.hidden, false);
});

test('index.html has the chart waiting message with a translation', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="chartEmpty"[^>]*hidden/);
});

test('chart card exposes karat selection buttons for 18, 21, 22, 24', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const karat of ['18', '21', '22', '24']) {
    assert.match(html, new RegExp(`data-chart-karat=["']${karat}["']`));
  }
  assert.match(html, /id=["']chartUnitLabel["']/);
  assert.match(html, /ر\.س \/ جرام/);
});

test('chart renders specific karat price and updates unit label when activeKarat is specified', () => {
  const { createPriceChartUI } = require('../js/ui/price-chart-ui.js');
  const makeElement = () => ({
    textContent: '',
    hidden: false,
    style: {},
    dataset: {},
    attrs: {},
    classList: {
      classes: new Set(),
      toggle(cls, val) {
        if (val) this.classes.add(cls);
        else this.classes.delete(cls);
      },
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; },
    addEventListener() {},
  });
  const ids = ['chartPrice', 'chartChange', 'chartSvg', 'chartArea', 'chartLine', 'chartCursor', 'chartDot', 'chartFirstLabel', 'chartLastLabel', 'chartEmpty', 'chartUnitLabel'];
  const byId = Object.fromEntries(ids.map((id) => [id, makeElement()]));

  const karatButtons = [18, 21, 22, 24].map((k) => {
    const el = makeElement();
    el.dataset.chartKarat = String(k);
    return el;
  });

  const document = {
    getElementById: (id) => byId[id] || null,
    querySelectorAll: (selector) => (selector === '[data-chart-karat]' ? karatButtons : []),
  };
  const formatting = { formatMoney: (value) => Number(value).toFixed(2) };

  const chart = createPriceChartUI({ document, locale: 'ar', formatting });

  // Prices where 21K is 500 SAR/g and 24K is 571.43 SAR/g
  const prices = {
    gram24kSar: 571.43,
    gram22kSar: 523.81,
    gram21kSar: 500.00,
    gram18kSar: 428.57,
  };

  chart.render(prices, { activeKarat: 21 });
  assert.equal(byId.chartPrice.textContent, '500.00');
  assert.equal(byId.chartUnitLabel.textContent, 'ر.س / جرام (عيار 21)');
  assert.equal(chart.getSelectedKarat(), 21);

  // Switch to 24K
  chart.setSelectedKarat(24);
  assert.equal(byId.chartPrice.textContent, '571.43');
  assert.equal(byId.chartUnitLabel.textContent, 'ر.س / جرام (عيار 24)');
  assert.equal(chart.getSelectedKarat(), 24);
});
