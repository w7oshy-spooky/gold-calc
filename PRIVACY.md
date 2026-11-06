# Privacy Policy / سياسة الخصوصية

_Last updated: 2026-11-07_

## English

Gold Calculator stores your data **only on your device**.

- **Vault pieces, photos, invoices and settings** are saved locally (IndexedDB / local storage). They are never uploaded to any server.
- **Backups** are files you export yourself. You decide where to save or share them.
- **Gold prices**: the app requests the current price from `gold-calc-live.vercel.app`. The request contains no personal data; like any web request it exposes your IP address to that server.
- No accounts, no analytics, no advertising, no tracking.
- Deleting the app or clearing its data removes everything stored on the device, so export a backup first.

The calculator is an estimate tool, not financial or religious (zakat) advice.

Contact: open an issue at https://github.com/w7oshy-spooky/gold-calc/issues

## العربية

تحفظ حاسبة الذهب بياناتك **على جهازك فقط**.

- **قطع الخزانة والصور والفواتير والإعدادات** تُحفظ محليًا ولا تُرفع إلى أي خادم.
- **النسخ الاحتياطية** ملفات تصدّرها بنفسك وتختار مكان حفظها أو مشاركتها.
- **أسعار الذهب**: يطلب التطبيق السعر الحالي من `gold-calc-live.vercel.app`. الطلب لا يحتوي بيانات شخصية، لكنه يكشف عنوان IP للخادم كأي طلب إنترنت.
- لا حسابات ولا تحليلات ولا إعلانات ولا تتبع.
- حذف التطبيق أو بياناته يمسح كل ما على الجهاز، فصدّر نسخة احتياطية قبل ذلك.

الحاسبة أداة تقديرية وليست استشارة مالية أو شرعية (زكاة).

للتواصل: افتح بلاغًا على https://github.com/w7oshy-spooky/gold-calc/issues

---

## Store publishing notes (not part of the policy)

- Host this file at a public URL (e.g. GitHub Pages / the Vercel site) and paste the URL into Play Console and App Store Connect.
- Play Console **Data safety**: no data collected or shared; data stays on device; network request is for price only.
- App Store **Privacy Nutrition Label**: "Data Not Collected".
- Android: set a unique `versionCode`, sign the release AAB (`Build > Generate Signed Bundle`), keep the keystore backed up.
- iOS: needs an Apple Developer account, bundle id `sa.goldcalc.assistant`, and screenshots for required device sizes.
