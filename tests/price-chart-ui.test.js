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
  for (const file of ['index.html', 'en.html']) {
    const html = fs.readFileSync(file, 'utf8');
    for (const id of ['chartPrice', 'chartChange', 'chartSvg', 'chartArea', 'chartLine', 'chartCursor', 'chartDot', 'chartFirstLabel', 'chartLastLabel']) {
      assert.match(html, new RegExp(`id="${id}"`), `${file} needs #${id}`);
    }
    assert.equal((html.match(/data-chart-range=/g) || []).length, 4);
    assert.ok(html.indexOf('js/ui/price-chart-ui.js') < html.indexOf('js/app.js'));
  }
});
