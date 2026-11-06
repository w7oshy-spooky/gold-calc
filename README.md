# Gold Calculator

Bilingual Arabic and English calculator for gold jewellery pricing and used-gold sale estimates in Saudi riyals.

## Features

- One page, `index.html`, in Arabic and English: switch with the EN / العربية button (or `?lang=en` / `?lang=ar`); the choice is remembered. `en.html` only redirects to `index.html?lang=en` for old links
- Static English text lives in `js/i18n/static-text.js` (keys referenced from `data-t` / `data-t-attr` in `index.html`); dynamic text lives in `js/i18n/translations.js`
- Live XAU/USD spot mode is the default price source
- Primary live provider: Gold API; automatic fallback: XAUS
- Live quote status, upstream timestamp, refresh button and 24K / 22K / 21K / 18K SAR-per-gram reference prices
- A recent live quote is cached locally for up to 15 minutes; if both providers fail and no recent cache exists, the UI falls back to manual ounce entry
- Manual price entry supports troy ounce in USD, troy ounce in SAR, or raw gold gram price in SAR with 18K / 21K / 22K / 24K selection
- Manual inputs are normalized to equivalent USD/oz, SAR/oz and 24K / 22K / 21K / 18K SAR-per-gram reference prices
- Buy mode: metal value + workmanship + optional extra margin + configurable VAT
- Sell mode: raw metal value minus an explicit buyer deduction percentage
- **Counter Stealth Auditor**: deconstructs the shop quote into raw metal, 15% ZATCA VAT, and net workmanship per gram, benchmarked against Saudi market categories (Plain 15-25, Gulf 25-45, Italian 45-80, Luxury 80+ SAR/g)
- **Stone & Zircon Deductor**: calculates hidden costs of non-gold stones and warns about resale weight deductions
- **Sharia & ZATCA Trade-in**: enforces contract separation (independent scrap liquidation at 0% VAT, and 15% VAT on the gross new purchase)
- **Shop Quote Comparison**: compares an entered quote with the calculated reference total and reports the SAR and percentage difference
- LIVE prices refresh automatically every minute while the page is visible, without flashing a loading state
- Inputs (mode, karat, weight, workmanship, VAT, deduction, price source, manual prices, stones) are remembered on the device; **Reset** restores the defaults
- **Share summary** sends the calculation through the native share sheet, or copies it to the clipboard
- **Invoice**: add several pieces (each keeps its own karat, weight, workmanship and VAT) and trade-in old gold in sell mode; the invoice shows purchases, trade-in value and the net to pay or receive, and the shop quote is compared against that net
- Mobile native packaging via **Capacitor** (`capacitor.config.json`, iOS & Android) + installable PWA (`manifest.webmanifest`, `sw.js`)
- Works offline: `sw.js` serves the app files network-first (cached copy after 3s or when offline); without a live price, the last known quote (up to 7 days) is filled in as a dated manual price

## Tests

Run all checks with Node.js 22 or newer:

```bash
npm run check
npm test
```

No live-price API key is required for the current providers. The Vercel Function keeps provider-specific response formats out of the browser UI and allows the upstream source to be changed later without rewriting the calculator.

## Mobile Build (Capacitor)

To build the native Android / iOS app using Capacitor:

```bash
npm install
npx cap add android
npx cap sync
npx cap open android
```

### App icon and splash screen

Source art lives in `assets/` (`icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`; the `.svg` files are the editable originals). After `npx cap add android` / `npx cap add ios`, generate every native icon, adaptive icon and splash size with:

```bash
npm run assets:generate
```

The PNGs in `icons/` are used by the PWA manifest and the iOS home-screen icon.

Backups and share cards cannot be downloaded from a WebView, so inside the app they are written to the app cache with `@capacitor/filesystem` and opened in the system share sheet (`@capacitor/share`). After pulling changes that add a plugin, run `npm install` and `npx cap sync` again so the native projects include it. In a browser they download as normal files.
