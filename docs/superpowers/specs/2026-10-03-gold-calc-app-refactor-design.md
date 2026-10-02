# Gold Calculator App Refactor — Design

Date: 2026-10-03

## 1. Goal

Refactor the current Gold Calculator frontend after the manual SAR ounce/gram feature is stable, without changing user-visible calculation behavior.

Primary outcomes:

- reduce `app.js` from a multi-responsibility file into a small bootstrap/orchestration entry point;
- separate market-price conversion, live-price fetching/cache, UI rendering, formatting, and translations;
- preserve the existing Vanilla JavaScript architecture and Vercel deployment model;
- keep Arabic and English behavior equivalent;
- preserve the existing calculation engine and all current buy/sell behavior;
- make future pricing features easier to add and test without touching unrelated code.

This is a structural refactor, not a framework migration.

## 2. Non-goals

The refactor will not:

- migrate to React, Next.js, TypeScript, or another framework;
- add a database, state-management library, bundler, or package manager dependency;
- change the calculation formulas, VAT behavior, buy/sell rules, or quote comparison thresholds;
- change the live-price providers unless a defect requires it;
- redesign the visual language of the application;
- merge the separate GitHub Actions Node 24 migration PR into this work.

## 3. Current problems

### 3.1 `app.js` owns too many concerns

The file currently contains:

- Arabic and English dynamic copy;
- live-price HTTP fetching;
- timeout and fallback behavior;
- localStorage cache handling;
- market-price source state;
- DOM rendering for market values;
- buy/sell mode behavior;
- quote comparison rendering;
- numeric formatting;
- event binding;
- calculation orchestration;
- dynamic LIVE UI creation.

These responsibilities make unrelated changes more likely to affect each other.

### 3.2 Some UI is created at runtime

The LIVE panel is still injected by JavaScript. The market-source controls now exist in HTML, while the LIVE detail panel remains dynamic. This splits the page structure between HTML and JavaScript and makes UI-contract tests less direct.

### 3.3 Dynamic copy is embedded in application logic

Translations used by JavaScript live inside `app.js`, increasing file size and coupling presentation copy to behavior.

### 3.4 Cache behavior is coupled to network behavior

Reading, validating, and writing the 15-minute quote cache is embedded in the same file as the fetch flow.

## 4. Target structure

The refactor will use browser-compatible plain JavaScript modules without introducing a build step.

```text
js/
├─ core/
│  └─ price-converter.js
├─ market/
│  ├─ live-price-client.js
│  └─ price-cache.js
├─ ui/
│  ├─ market-ui.js
│  ├─ transaction-ui.js
│  ├─ quote-comparison-ui.js
│  ├─ summary-ui.js
│  └─ formatting.js
├─ i18n/
│  └─ translations.js
└─ app.js
```

Existing files remain where they already provide a clear public boundary:

```text
gold-calculator.js
live-gold.js
api/gold-price.js
```

The exact location of the existing calculator core may remain at repository root to avoid unnecessary churn. The refactor should move code only when the move creates a meaningful boundary.

## 5. Module responsibilities

### 5.1 `gold-calculator.js`

Responsibility: transaction-domain calculations.

Owns:

- buy calculation;
- sell calculation;
- VAT calculation;
- workmanship and margin calculation;
- buyer deduction;
- quote comparison;
- transaction-mode normalization.

It must not own DOM operations, browser storage, fetch calls, or user-facing copy.

The new SAR/USD/gram conversion functions may initially remain here for compatibility, but the implementation plan should extract them to `js/core/price-converter.js` only if this can be done without duplicating constants or introducing two sources of truth.

### 5.2 `js/core/price-converter.js`

Responsibility: normalize any supported market-price input to one canonical market-price model.

Supported inputs:

- LIVE XAU/USD ounce;
- manual USD/oz;
- manual SAR/oz;
- manual SAR/g with 18K, 21K, 22K, or 24K.

Canonical output:

```js
{
  ounceUsd,
  ounceSar,
  gram24kSar,
  gram22kSar,
  gram21kSar,
  gram18kSar
}
```

Rules:

- troy ounce constant: `31.1034768` grams;
- USD/SAR conversion: `3.75`;
- no early rounding;
- invalid or non-positive source data resolves to an unavailable/zero normalized result consistent with existing calculator behavior;
- display rounding is never fed back into subsequent calculations.

### 5.3 `js/market/live-price-client.js`

Responsibility: browser-side live-price retrieval.

Owns:

- request to `/api/gold-price`;
- browser timeout;
- response validation required by the UI;
- refresh query parameter;
- returning a normalized quote or throwing a typed/identifiable error.

It does not own localStorage or DOM rendering.

### 5.4 `js/market/price-cache.js`

Responsibility: cached quote persistence.

Public interface:

```js
readCachedQuote()
writeCachedQuote(quote)
clearCachedQuote()
```

Rules:

- preserve the current 15-minute maximum age;
- reject malformed, non-positive, or expired quotes;
- storage failures remain non-fatal;
- no UI side effects.

### 5.5 `js/ui/market-ui.js`

Responsibility: all market-source UI state.

Owns:

- source selection: LIVE / USD ounce / SAR ounce / SAR gram;
- showing/hiding source-specific inputs;
- SAR gram input karat selection;
- rendering equivalent market values;
- rendering LIVE status and timestamp;
- exposing current market inputs to the application orchestrator.

It does not perform fetches or transaction calculations.

### 5.6 `js/ui/transaction-ui.js`

Responsibility: buy/sell mode and transaction input presentation.

Owns:

- buy/sell button state;
- showing/hiding buy-only and sell-only sections;
- reading weight, karat, workmanship, margin, VAT, and deduction inputs;
- input sanitization that is presentation-specific.

It does not calculate totals.

### 5.7 `js/ui/quote-comparison-ui.js`

Responsibility: render the result returned by `compareQuote()`.

It does not decide thresholds.

### 5.8 `js/ui/summary-ui.js`

Responsibility: render calculated transaction outputs.

Owns:

- gold cost/raw metal value;
- labor/margin or buyer deduction;
- subtotal/reference payout;
- VAT;
- final total;
- weight/karat summary labels.

### 5.9 `js/ui/formatting.js`

Responsibility: pure display formatting.

Examples:

- money;
- signed money;
- percentages;
- date/time display;
- input-friendly decimal formatting.

It must not read DOM state.

### 5.10 `js/i18n/translations.js`

Responsibility: JavaScript-owned dynamic copy only.

Structure:

```js
{
  ar: { market, live, transaction, comparison, summary },
  en: { market, live, transaction, comparison, summary }
}
```

Static page copy may remain in `index.html` and `en.html`; the refactor does not require building a runtime template/i18n framework.

### 5.11 `js/app.js`

Responsibility: application bootstrap and coordination only.

Expected shape:

```js
init()
  -> determine locale
  -> initialize UI modules
  -> bind market-source changes
  -> request/restore LIVE price when required
  -> normalize price
  -> call transaction core
  -> render result
```

Target: a small, readable orchestrator rather than another utility container.

A strict byte-size target is not a correctness requirement. The goal is responsibility reduction, not an arbitrary file-size metric.

## 6. HTML changes

### 6.1 Move LIVE panel markup into HTML

The LIVE status panel must exist in both `index.html` and `en.html`.

JavaScript will only update:

- status;
- source;
- timestamp;
- 24K/22K/21K/18K values;
- visibility.

No application module should inject major structural UI blocks with `insertAdjacentHTML`.

### 6.2 Keep bilingual pages

The project will keep:

- `index.html` for Arabic;
- `en.html` for English.

Removing this duplication is outside the scope of this refactor because doing so would require a templating/build strategy that the project does not otherwise need.

## 7. Data flow

### LIVE

```text
/app load
  -> live-price-client
  -> /api/gold-price
  -> normalized live quote
  -> price-cache.write
  -> price-converter
  -> canonical market-price model
  -> gold-calculator transaction calculation
  -> UI renderers
```

Failure path:

```text
live request fails
  -> price-cache.read
     -> valid recent quote: use cached quote + cached status
     -> no valid quote: switch to manual USD/oz + show warning
```

### Manual SAR ounce

```text
SAR/oz input
  -> price-converter
  -> canonical market-price model
  -> transaction calculation
  -> UI renderers
```

### Manual SAR gram

```text
SAR/g + input karat
  -> normalize to 24K
  -> derive SAR/oz and USD/oz
  -> canonical market-price model
  -> transaction calculation
  -> UI renderers
```

## 8. Error handling

- Network failures must never erase a valid recent cache before fallback is attempted.
- Cache parse/storage errors are non-fatal.
- Invalid manual price inputs show unavailable output rather than NaN or Infinity.
- A missing DOM element required by a module should fail initialization clearly during development rather than silently corrupting state.
- Live quote validation remains defensive against non-positive price and invalid timestamp.
- Existing server-side primary/fallback provider behavior remains unchanged unless a dedicated bug is found.

## 9. Testing strategy

The refactor must be behavior-preserving.

Required test groups:

```text
tests/
├─ gold-calculator.test.js
├─ price-converter.test.js
├─ live-gold.test.js
├─ price-cache.test.js
├─ market-ui-contract.test.js
└─ ui-contract.test.js
```

Required coverage:

- USD ounce -> SAR ounce -> gram conversions;
- SAR ounce -> USD ounce;
- SAR gram 18/21/22/24 -> 24K and ounce conversions;
- round-trip conversion tolerance;
- no early rounding;
- cache valid / expired / malformed / storage failure;
- LIVE fallback behavior;
- all four market source modes in Arabic and English;
- Arabic/English required ID parity;
- buy and sell regression calculations;
- quote-comparison regression;
- existing VAT slider RTL/LTR behavior.

The final gate remains:

```bash
node --check <all JS files>
node --test tests/*.test.js
```

Vercel Preview must also reach READY before merge.

## 10. Migration sequence

1. Establish full green baseline on the manual-SAR feature branch.
2. Extract pure formatting and translation modules.
3. Extract cache logic with tests.
4. Extract live-price client with tests.
5. Extract price conversion into a single source of truth.
6. Move LIVE markup from runtime injection into both HTML files.
7. Extract market UI.
8. Extract transaction, comparison, and summary UI.
9. Reduce `app.js` to orchestration.
10. Run the complete regression suite and verify Vercel Preview.
11. Review the whole diff before merge.

Each extraction should keep the application runnable and tests green before moving to the next boundary.

## 11. Compatibility and deployment

- No new runtime dependency.
- No package installation required.
- No backend deployment change.
- Vercel continues serving static HTML/CSS/JS plus `api/gold-price.js`.
- Browser support remains equivalent to the current application.
- Existing public URL remains unchanged after merge.

## 12. Acceptance criteria

The refactor is complete only when:

- all current functionality works unchanged;
- LIVE, USD/oz, SAR/oz, and SAR/g inputs work;
- Arabic and English flows remain equivalent;
- `app.js` contains orchestration rather than cache, fetch, translation, formatting, and major rendering implementations;
- no major UI structure is generated dynamically;
- conversion constants have one source of truth;
- every extracted module has focused tests where behavior is non-trivial;
- the full test suite is green;
- Vercel Preview is READY;
- no Critical or Important code-review findings remain.
