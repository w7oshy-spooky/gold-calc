# Handoff: Gold Calculator mobile app

Status as of 2026-11-07. The web app and the Capacitor wrapper are on `main`; the native app has **not yet been run on a real device or emulator** (everything native was verified by unit tests only).

## What is in the app now
- One bilingual page (Arabic / English switch), PWA with offline service worker (website only; disabled inside the native app).
- Native helpers: file export through the share sheet, Android back button, optional biometric lock, app icons and splash sources (`assets/`, `icons/`).
- Vault extras: total gain/loss, Zakat hawl countdown, periodic backup reminder.
- `PRIVACY.md` (bilingual) for the store listings.

Decided **not** to build: server push notifications and price alerts (they cost money / need a server). The `feat/price-alerts` branch (closed PR #31) keeps an in-app-only version if wanted later.

## Build Android (Windows)
1. Install Node.js and Android Studio (open it once so it installs the SDK).
2. `git pull`, then `npm install` (new packages were added: `@capacitor/app`, `@aparajita/capacitor-biometric-auth`, `@capacitor/assets`).
3. One time: `npm run build:mobile` then `npx cap add android` (creates `android/`, which is not committed).
4. `npm run assets:generate` to create icons and splash screens from `assets/` (not yet tested; send the error if it fails).
5. `npm run cap:android` to sync and open Android Studio.
6. Run on an emulator (Device Manager, Pixel, Android 13+) or a phone with USB debugging.
7. Debug APK: `npm run build:apk` writes `gold-calc-app.apk`. If JDK 21 is not found, set `JAVA_HOME` to an installed JDK or to the `jbr` folder inside Android Studio.

After pulling later changes that add a plugin: `npm install` and `npx cap sync` again.

## Build iOS
Needs a Mac with Xcode and an Apple Developer account (bundle id `sa.goldcalc.assistant`).
`npx cap add ios`, `npm run assets:generate`, then add `NSFaceIDUsageDescription` to `ios/App/App/Info.plist` (required for the biometric lock), `npm run cap:ios`.

## Checklist to verify on a device
- [ ] Icon and splash screen look right (light and dark).
- [ ] Backup export opens the share sheet; restoring the same file works.
- [ ] Back button: closes a dialog, then returns to the market tab, then exits.
- [ ] Lock switch appears in the Vault tab, locks on launch and after 30 s in the background, and unlocks with biometrics / passcode.
- [ ] Live price loads; offline shows the last known price.
- [ ] Vault: add a piece with a purchase price, check gain/loss; set a hawl start date once the nisab is reached.
- [ ] Backup reminder shows when pieces exist and no backup was made.

## Before publishing
- Host `PRIVACY.md` at a public URL and use it in Play Console / App Store Connect.
- Play "Data safety": no data collected or shared. App Store label: "Data Not Collected".
- Android: sign a release AAB, set a unique `versionCode`, keep the keystore backed up.
- Review the privacy policy yourself before publishing (it was not legally reviewed).

## Repo workflow notes
- Any change to a file listed in `APP_SHELL` in `sw.js` needs `npm run stamp:sw`; CI fails otherwise.
- `tailwind.css` is generated; regenerate with `npx tailwindcss@3.4.17 -c tailwind.config.js -o tailwind.css --minify` after HTML or JS class changes.
- Run `npm test` before pushing (264 tests on the last branch; 258 on `main`).
- If the head inline script in `index.html` changes, update its hash in the CSP meta tag (`tests/csp.test.js` prints it).

## Remaining ideas (none started)
Transaction history, invoice as PDF, multi-currency price display, first-run welcome screens, `js/app.js` split (684 lines).
