# Gold Calculator

Bilingual Arabic and English calculator for gold jewellery pricing and used-gold sale estimates in Saudi riyals.

## Features

- Arabic: `index.html`
- English: `en.html`
- Live XAU/USD spot mode is the default price source
- Primary live provider: Gold API; automatic fallback: XAUS
- Live quote status, upstream timestamp, refresh button and 24K / 22K / 21K / 18K SAR-per-gram reference prices
- A recent live quote is cached locally for up to 15 minutes; if both providers fail and no recent cache exists, the UI falls back to manual ounce entry
- Manual price entry supports troy ounce in USD, troy ounce in SAR, or raw gold gram price in SAR with 18K / 21K / 22K / 24K selection
- Manual inputs are normalized to equivalent USD/oz, SAR/oz and 24K / 22K / 21K / 18K SAR-per-gram reference prices
- Buy mode: metal value + workmanship + optional extra margin + configurable VAT
- Sell mode: raw metal value minus an explicit buyer deduction percentage
- Shop Quote Comparison: compares an entered quote with the calculated reference total and reports the SAR and percentage difference
- LIVE prices refresh automatically every minute while the page is visible, without flashing a loading state
- Inputs (mode, karat, weight, workmanship, VAT, deduction, price source and manual prices) are remembered on the device; **Reset** restores the defaults
- **Share summary** sends the calculation through the native share sheet, or copies it to the clipboard
- Installable as a home-screen web app (`manifest.webmanifest`, `icon.svg`)
- Saved preferences: `js/state/preferences-store.js`
- Share summary / reset actions: `js/ui/share-ui.js`
- Market-price conversion: `js/core/price-converter.js`
- Transaction calculation core: `gold-calculator.js`
- Live quote normalization: `live-gold.js`
- Browser live-price client/cache: `js/market/`
- Focused market/transaction/result UI modules: `js/ui/`
- Dynamic Arabic/English copy: `js/i18n/translations.js`
- Application bootstrap/orchestration: `js/app.js`
- Vercel Function: `api/gold-price.js`

Live spot quotes are indicative raw-gold references, not guaranteed shop execution prices. Real transactions can differ because of bid/ask spreads, workmanship, stones, promotions, commercial policy and tax treatment.

## Tests

Run all checks with Node.js 22 or newer:

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
node --check js/ui/share-ui.js
node --check js/state/preferences-store.js
node --check js/app.js
node --test tests/*.test.js
```

No live-price API key is required for the current providers. The Vercel Function keeps provider-specific response formats out of the browser UI and allows the upstream source to be changed later without rewriting the calculator.


## Frontend architecture

The browser app stays dependency-free at runtime. Utility classes are served from the prebuilt `tailwind.css` instead of the Tailwind Play CDN script; after adding or changing Tailwind classes in the HTML or JS, regenerate it (CI fails if it is stale):

```bash
npx --yes tailwindcss@3.4.17 -c tailwind.config.js -o tailwind.css --minify
```
 Price conversion, network/cache behavior, formatting/translations, and DOM rendering are separated into focused modules; `js/app.js` coordinates them and keeps the existing static Vercel deployment model.
