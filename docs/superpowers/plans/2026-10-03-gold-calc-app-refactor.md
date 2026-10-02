# Gold Calculator App Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Gold Calculator frontend into focused plain-JavaScript modules while preserving all current behavior and deployment semantics.

**Architecture:** Keep classic browser scripts and CommonJS-compatible module wrappers so every extracted module can be tested with Node without adding a bundler. Move conversion, cache, network, formatting, translation, and UI responsibilities out of the monolithic root `app.js`; finish with `js/app.js` as the only orchestration layer.

**Tech Stack:** Vanilla JavaScript, Node.js 22 test runner, static HTML/CSS, Vercel Functions.

**Spec:** `docs/superpowers/specs/2026-10-03-gold-calc-app-refactor-design.md`

## Global Constraints

- No React, Next.js, TypeScript, database, state-management library, bundler, or package-manager dependency.
- Keep troy ounce mass exactly `31.1034768` grams.
- Keep USD/SAR conversion exactly `3.75`.
- Preserve supported karats: 18, 21, 22, 24.
- Preserve 15-minute LIVE cache maximum age.
- Preserve 8-second browser LIVE request timeout.
- Preserve existing buy/sell, VAT, deduction, quote-comparison, and live-provider behavior.
- No early rounding in market-price calculations.
- Keep `index.html` Arabic and `en.html` English.
- Keep the same Vercel public project and API endpoint `/api/gold-price`.
- No major UI structure generated at runtime.

## Review Focus

1. **Unavailable or throwing localStorage:** LIVE fetching and manual use must remain usable; cache failures must be non-fatal. Covered in Task 3 cache tests.
2. **HTTP 200 with invalid LIVE payload:** zero/negative price or invalid timestamp must be rejected exactly like a failed request. Covered in Task 3 client tests.
3. **Both network and cache unavailable:** UI must switch to manual USD/oz without leaving stale LIVE values active. Covered in Task 6 integration contract.
4. **Arabic/English DOM drift:** both pages must expose the same required IDs, source modes, LIVE panel, and script dependency order. Covered in Task 4 and Task 6 parity tests.
5. **Rounded displayed values accidentally reused as calculation inputs:** canonical market values must remain full precision and render-only rounding must not change round-trip results. Covered in Task 1 converter tests.

---

### Task 1: Extract market-price conversion into one source of truth

**Files:**
- Create: `js/core/price-converter.js`
- Modify: `gold-calculator.js`
- Create: `tests/price-converter.test.js`
- Modify: `tests/gold-calculator.test.js`
- Modify: `index.html`
- Modify: `en.html`

**Interfaces:**
- Produces: `globalThis.GoldPriceConverter` and CommonJS export containing:
  - `OUNCE_GRAMS`
  - `USD_SAR_RATE`
  - `SUPPORTED_KARATS`
  - `sanitizeNonNegative(value)`
  - `normalizeKarat(value)`
  - `ounceUsdTo24kSar(value)`
  - `ounceSarToUsd(value)`
  - `ounceSarTo24kSar(value)`
  - `gramSarTo24kSar(value, karat)`
  - `gramSarToOunceSar(value, karat)`
  - `gramSarToOunceUsd(value, karat)`
  - `resolvePrice24k(input)`
  - `deriveMarketPrices(input)`
- Consumes: none.

- [ ] **Step 1: Write failing converter tests**
  - Move the existing market conversion assertions into `tests/price-converter.test.js`.
  - Add round-trip assertions for 18K, 21K, 22K, and 24K gram prices.
  - Assert constants are exactly `31.1034768` and `3.75`.
  - Assert invalid/non-positive inputs yield zero canonical values.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:
```bash
node --test tests/price-converter.test.js tests/gold-calculator.test.js
```
Expected: FAIL because `js/core/price-converter.js` does not exist or the new exported API is unavailable.

- [ ] **Step 3: Implement the converter module and remove duplicate conversion ownership from `gold-calculator.js`**
  - Use a browser-global/CommonJS wrapper matching the current project style.
  - `gold-calculator.js` keeps transaction-domain functions only and consumes shared sanitization/karat normalization from `GoldPriceConverter`.
  - Load `js/core/price-converter.js` before `gold-calculator.js` in both HTML pages.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
```bash
node --check js/core/price-converter.js
node --check gold-calculator.js
node --test tests/price-converter.test.js tests/gold-calculator.test.js
```
Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/price-converter.js gold-calculator.js tests/price-converter.test.js tests/gold-calculator.test.js index.html en.html
git commit -m "refactor: extract market price converter"
```

---

### Task 2: Extract formatting and dynamic translations

**Files:**
- Create: `js/ui/formatting.js`
- Create: `js/i18n/translations.js`
- Create: `tests/formatting.test.js`
- Modify: `tests/ui-contract.test.js`
- Modify: `index.html`
- Modify: `en.html`
- Modify: `app.js` temporarily until final bootstrap move.

**Interfaces:**
- Consumes: no Task 1 interface.
- Produces:
  - `GoldFormatting.createFormatting(locale)` returning `formatMoney`, `formatInput`, `formatSignedMoney`, `formatSignedPercent`, `formatLiveTime`, `sourceDisplayName`.
  - `GoldTranslations.getCopy(locale)` returning the current Arabic or English dynamic-copy object.

- [ ] **Step 1: Write failing formatting and translation contract tests**
  - Verify money and signed formatting preserve current output.
  - Verify invalid live time renders `—`.
  - Verify Arabic and English copies expose the same required keys for market, live, transaction, comparison, and summary text.

- [ ] **Step 2: Run focused tests and verify RED**

Run:
```bash
node --test tests/formatting.test.js tests/ui-contract.test.js
```
Expected: FAIL because extracted modules are absent.

- [ ] **Step 3: Implement the two pure modules and switch `app.js` to consume them**
  - Remove the inline `copy` object and formatting function bodies from `app.js`.
  - Keep output strings unchanged.
  - Add scripts before the application script in both HTML pages.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
```bash
node --check js/ui/formatting.js
node --check js/i18n/translations.js
node --check app.js
node --test tests/formatting.test.js tests/ui-contract.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui/formatting.js js/i18n/translations.js tests/formatting.test.js tests/ui-contract.test.js index.html en.html app.js
git commit -m "refactor: extract formatting and translations"
```

---

### Task 3: Extract LIVE cache and browser price client

**Files:**
- Create: `js/market/price-cache.js`
- Create: `js/market/live-price-client.js`
- Create: `tests/price-cache.test.js`
- Create: `tests/live-price-client.test.js`
- Modify: `app.js`
- Modify: `index.html`
- Modify: `en.html`

**Interfaces:**
- Consumes: Task 2 formatting only indirectly through the app.
- Produces:
  - `GoldPriceCache.createPriceCache({ storage, now, maxAgeMs })` → `readCachedQuote()`, `writeCachedQuote(quote)`, `clearCachedQuote()`.
  - `GoldLivePriceClient.createLivePriceClient({ fetchImpl, AbortControllerImpl, setTimeoutImpl, clearTimeoutImpl, now })` → `fetchQuote({ force })`.

- [ ] **Step 1: Write failing cache tests**
  - valid cached quote within 15 minutes returns quote;
  - expired quote returns null;
  - malformed JSON returns null;
  - non-positive quote returns null;
  - storage getter/setter throwing is non-fatal;
  - clear failure is non-fatal.

- [ ] **Step 2: Write failing client tests**
  - normal request uses `/api/gold-price`;
  - forced request uses `/api/gold-price?refresh=<now>`;
  - non-OK response rejects;
  - zero/negative price rejects;
  - invalid timestamp rejects;
  - timeout uses 8000 ms and aborts when AbortController is available.

- [ ] **Step 3: Run focused tests and verify RED**

Run:
```bash
node --test tests/price-cache.test.js tests/live-price-client.test.js
```
Expected: FAIL because modules are absent.

- [ ] **Step 4: Implement cache and client modules, then consume them from `app.js`**
  - Remove direct `localStorage`, timeout setup, response validation, and raw `fetch` ownership from `app.js`.
  - Preserve current fallback sequence: network → recent cache → manual USD/oz.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:
```bash
node --check js/market/price-cache.js
node --check js/market/live-price-client.js
node --check app.js
node --test tests/price-cache.test.js tests/live-price-client.test.js
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/market/price-cache.js js/market/live-price-client.js tests/price-cache.test.js tests/live-price-client.test.js app.js index.html en.html
git commit -m "refactor: extract live price cache and client"
```

---

### Task 4: Move LIVE markup into HTML and extract market UI

**Files:**
- Create: `js/ui/market-ui.js`
- Create: `tests/market-ui-contract.test.js`
- Modify: `index.html`
- Modify: `en.html`
- Modify: `app.js`
- Modify: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes:
  - Task 1 `GoldPriceConverter.deriveMarketPrices(input)`.
  - Task 2 formatting/copy functions.
- Produces: `GoldMarketUI.createMarketUI({ document, locale, copy, formatting, priceConverter, onChange, onRefresh })` with:
  - `getMarketInput()`
  - `setPriceSource(source)`
  - `setGramInputKarat(karat)`
  - `renderMarketEquivalents(prices)`
  - `renderLiveStatus(quote, state)`
  - `renderLiveKaratPrices(priceUsdOunce)`
  - `setLiveQuoteInput(priceUsdOunce)`
  - `showWarning(message)`
  - `clearWarning()`.

- [ ] **Step 1: Add failing HTML/market UI contract tests**
  - Both pages contain `livePricePanel`, `liveRefresh`, `livePriceStatus`, `liveUpdatedAt`, and 24/22/21/18 LIVE output IDs directly in HTML.
  - Both pages expose identical required market IDs and all four source buttons.
  - Application code contains no `insertAdjacentHTML` for the LIVE block.
  - Market UI module exists and owns source mode/gram karat behavior.

- [ ] **Step 2: Run focused tests and verify RED**

Run:
```bash
node --test tests/market-ui-contract.test.js tests/ui-contract.test.js
```
Expected: FAIL because LIVE markup is still runtime-generated and module is absent.

- [ ] **Step 3: Move LIVE markup into both HTML pages and implement `market-ui.js`**
  - Keep visible copy and CSS classes equivalent.
  - Remove `installLiveUi()` from `app.js`.
  - Move note replacement behavior to translations/HTML without runtime structural injection.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
```bash
node --check js/ui/market-ui.js
node --check app.js
node --test tests/market-ui-contract.test.js tests/ui-contract.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui/market-ui.js tests/market-ui-contract.test.js tests/ui-contract.test.js index.html en.html app.js
git commit -m "refactor: extract market UI and static live markup"
```

---

### Task 5: Extract transaction, comparison, and summary UI

**Files:**
- Create: `js/ui/transaction-ui.js`
- Create: `js/ui/quote-comparison-ui.js`
- Create: `js/ui/summary-ui.js`
- Modify: `app.js`
- Modify: `tests/ui-contract.test.js`
- Modify: `index.html`
- Modify: `en.html`

**Interfaces:**
- Consumes:
  - `GoldCalculator.normalizeMode`, `sanitizeNonNegative`, `clampTaxRate`, `clampPercent`, `compareQuote`, `calculateTransaction`.
  - Task 2 formatting and translations.
- Produces:
  - `GoldTransactionUI.createTransactionUI({ document, core, copy, onChange })` → `getTransactionInput()`, `setTransactionMode(mode)`, `setKarat(karat)`, `renderInputLabels(result)`.
  - `GoldQuoteComparisonUI.createQuoteComparisonUI({ document, copy, formatting })` → `render(comparison)`.
  - `GoldSummaryUI.createSummaryUI({ document, copy, formatting })` → `render(result)`.

- [ ] **Step 1: Add failing ownership contract tests**
  - `transaction-ui.js` owns buy/sell panel visibility and transaction input reads.
  - `quote-comparison-ui.js` contains no comparison thresholds or percentage rules.
  - `summary-ui.js` renders but does not call `calculateTransaction`.
  - Root `app.js` no longer directly manipulates transaction/summary/comparison DOM IDs.

- [ ] **Step 2: Run contract tests and verify RED**

Run:
```bash
node --test tests/ui-contract.test.js
```
Expected: FAIL because responsibilities still live in root `app.js`.

- [ ] **Step 3: Implement the three UI modules and consume them from the application**
  - Keep all current field sanitization and event behavior.
  - Keep quote thresholds only in `gold-calculator.js`.
  - Keep VAT slider fill update behavior unchanged.

- [ ] **Step 4: Run focused regression tests and verify GREEN**

Run:
```bash
node --check js/ui/transaction-ui.js
node --check js/ui/quote-comparison-ui.js
node --check js/ui/summary-ui.js
node --check app.js
node --test tests/gold-calculator.test.js tests/ui-contract.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/ui/transaction-ui.js js/ui/quote-comparison-ui.js js/ui/summary-ui.js app.js tests/ui-contract.test.js index.html en.html
git commit -m "refactor: extract transaction and result UI"
```

---

### Task 6: Replace root app with orchestration bootstrap and update delivery gates

**Files:**
- Create: `js/app.js`
- Delete: `app.js`
- Modify: `index.html`
- Modify: `en.html`
- Modify: `.github/workflows/test.yml`
- Modify: `.github/workflows/package-site.yml`
- Modify: `README.md`
- Modify: `tests/ui-contract.test.js`

**Interfaces:**
- Consumes all prior task module APIs.
- Produces: one browser bootstrap that coordinates initialization, LIVE/cache/manual fallback, calculation, and rendering.

- [ ] **Step 1: Write failing final orchestration contracts**
  - Both HTML files load scripts in dependency order:
    1. price converter;
    2. transaction core;
    3. translations/formatting;
    4. cache/client;
    5. UI modules;
    6. `js/app.js`.
  - No HTML references root `app.js`.
  - `js/app.js` contains no `localStorage`, no raw `fetch(`, no translation dictionary, no formatting implementation, and no `insertAdjacentHTML`.
  - LIVE failure path explicitly uses recent cache before `setPriceSource('ounce-usd')`.
  - Arabic and English required IDs remain in parity.

- [ ] **Step 2: Run final contract tests and verify RED**

Run:
```bash
node --test tests/ui-contract.test.js tests/market-ui-contract.test.js
```
Expected: FAIL until bootstrap and script paths are migrated.

- [ ] **Step 3: Implement `js/app.js`, remove root `app.js`, and update HTML/workflows/package manifest**
  - Keep the in-flight LIVE request guard in the bootstrap.
  - Application startup defaults to buy mode + LIVE.
  - Network failure → valid recent cache → manual USD/oz only when no cache exists.
  - Update GitHub Actions syntax checks to every new JS module.
  - Package `js/**` in `package-site.yml`.
  - Update README architecture section.

- [ ] **Step 4: Run full local-equivalent verification**

Run:
```bash
node --check js/core/price-converter.js
node --check gold-calculator.js
node --check live-gold.js
node --check api/gold-price.js
node --check js/i18n/translations.js
node --check js/market/price-cache.js
node --check js/market/live-price-client.js
node --check js/ui/formatting.js
node --check js/ui/market-ui.js
node --check js/ui/transaction-ui.js
node --check js/ui/quote-comparison-ui.js
node --check js/ui/summary-ui.js
node --check js/app.js
node --test tests/*.test.js
```
Expected: all syntax checks exit 0 and all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: modularize gold calculator frontend"
```

- [ ] **Step 6: Open draft PR and verify delivery gates**
  - GitHub Actions test workflow: SUCCESS.
  - Vercel Preview: READY.
  - Compare branch against `main`; confirm only refactor/spec/plan files changed.
  - Review all Critical/Important findings before merge.

