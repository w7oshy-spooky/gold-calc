# Gold Calculator App Refactor — Design

Date: 2026-10-03

## Goal

Refactor the current Gold Calculator frontend after the manual SAR ounce/gram feature is stable, without changing user-visible calculation behavior.

Primary outcomes:

- reduce `app.js` from a multi-responsibility file into a small bootstrap/orchestration entry point;
- separate market-price conversion, live-price fetching/cache, UI rendering, formatting, and translations;
- preserve the existing Vanilla JavaScript architecture and Vercel deployment model;
- keep Arabic and English behavior equivalent;
- preserve the existing calculation engine and all current buy/sell behavior;
- make future pricing features easier to add and test without touching unrelated code.

This is a structural refactor, not a framework migration.

## Non-goals

The refactor will not:

- migrate to React, Next.js, TypeScript, or another framework;
- add a database, state-management library, bundler, or package manager dependency;
- change the calculation formulas, VAT behavior, buy/sell rules, or quote comparison thresholds;
- change the live-price providers unless a defect requires it;
- redesign the visual language of the application;
- merge the separate GitHub Actions Node 24 migration PR into this work.

## Target structure

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

Existing server/domain files remain at repository root where appropriate:

```text
gold-calculator.js
live-gold.js
api/gold-price.js
```

## Module responsibilities

### `gold-calculator.js`

Transaction-domain calculations only:

- buy calculation;
- sell calculation;
- VAT;
- workmanship and margin;
- buyer deduction;
- quote comparison;
- transaction mode normalization.

No DOM, browser storage, fetch calls, translations, or market-price conversion constants.

### `js/core/price-converter.js`

Single source of truth for:

- troy ounce grams: `31.1034768`;
- USD/SAR rate: `3.75`;
- supported karats: 18, 21, 22, 24;
- USD/oz, SAR/oz, and SAR/g conversions;
- canonical market price model:

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

No early rounding. Invalid or non-positive market inputs resolve to the same unavailable/zero behavior used today.

### `js/market/live-price-client.js`

Browser-side request to `/api/gold-price`, including:

- 8-second timeout;
- `?refresh=<timestamp>` on forced refresh;
- HTTP validation;
- positive price validation;
- valid timestamp validation.

No localStorage and no DOM rendering.

### `js/market/price-cache.js`

Public interface:

```js
readCachedQuote()
writeCachedQuote(quote)
clearCachedQuote()
```

Preserve the 15-minute maximum age. Reject malformed, expired, and non-positive quotes. Storage errors are non-fatal.

### `js/ui/market-ui.js`

Own:

- LIVE / USD ounce / SAR ounce / SAR gram selection;
- source-specific panel visibility;
- gram-input karat selection;
- market equivalents;
- LIVE status and timestamp;
- market input reads.

No fetches or transaction formulas.

### `js/ui/transaction-ui.js`

Own buy/sell UI mode, input reads, presentation-specific sanitization, and buy/sell panel visibility. No transaction formulas.

### `js/ui/quote-comparison-ui.js`

Render `compareQuote()` output only. Thresholds remain in `gold-calculator.js`.

### `js/ui/summary-ui.js`

Render transaction result values and labels only.

### `js/ui/formatting.js`

Pure money, signed-money, percentage, date/time, and input formatting. No DOM access.

### `js/i18n/translations.js`

Dynamic Arabic/English copy only. Static page copy stays in the two HTML files.

### `js/app.js`

Bootstrap/orchestration only:

```text
determine locale
→ initialize UI modules
→ resolve LIVE/cache/manual market source
→ normalize market price
→ calculate transaction
→ render summary/comparison
```

## HTML

The LIVE panel must exist directly in both `index.html` and `en.html`. JavaScript updates its state and values only. Major structural UI blocks must not be injected with `insertAdjacentHTML`.

The bilingual pages remain separate; no templating or build layer is introduced.

## Error handling

- Network failure tries a valid recent cache before manual fallback.
- Cache parse/storage errors are non-fatal.
- Invalid manual input never renders NaN or Infinity.
- Required missing DOM elements fail initialization clearly.
- Invalid live price or timestamp is rejected.
- Server-side provider fallback behavior remains unchanged.

## Testing

Required focused tests:

```text
tests/
├─ gold-calculator.test.js
├─ price-converter.test.js
├─ live-gold.test.js
├─ price-cache.test.js
├─ live-price-client.test.js
├─ market-ui-contract.test.js
└─ ui-contract.test.js
```

Coverage must preserve:

- all four market input modes;
- 18/21/22/24 gram conversions;
- round-trip conversion tolerance;
- no early rounding;
- cache valid/expired/malformed/storage failure;
- LIVE network/cache/manual fallback;
- Arabic/English DOM parity;
- buy/sell calculations;
- quote comparison;
- RTL/LTR VAT slider behavior.

## Compatibility

- No new runtime dependency.
- No package manager or build step.
- No backend deployment change.
- Vercel continues serving static HTML/CSS/JS plus `api/gold-price.js`.
- Existing public URL remains unchanged.

## Acceptance criteria

Complete only when:

- current functionality remains unchanged;
- LIVE, USD/oz, SAR/oz, and SAR/g inputs work in both languages;
- `app.js` is orchestration only;
- no major UI block is generated dynamically;
- conversion constants have one source of truth;
- extracted behavior has focused tests;
- full test suite is green;
- Vercel Preview is READY;
- no Critical or Important review finding remains.
