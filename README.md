# Setidevi Dairy · सेतीदेवी डेरी

An Android app for **dairy farmers** in Nepal: daily milk, animals, feed, sales to the cooperative, bills, insurance and full accounts.
Works fully **offline**, in **Nepali and English**, with big picture buttons so anyone can use it.

## Features

| Area | What it does |
|---|---|
| 📅 Nepali calendar | Every date is in Bikram Sambat (BS), with the English date shown under it. Month calendar shows milk liters on each day. Supports BS 2060–2090. |
| 🥛 Daily milk | Milk from each animal, morning and evening, on one screen. |
| 🚚 Milk sales | Milk sold to the cooperative/dairy: enter liters and fat; the amount is calculated from the rate in Settings (**rate per liter = fat % × rate per fat + morning/evening extra**). Paid now or later (credit). |
| 🐄 Animals | Cow / buffalo / goat, tag, breed, status (milking/pregnant/dry), photo. |
| 🌾 Feed | Dana, bhusa, grass, mineral… for one animal or all, with cost, cash/bank/credit and bill photo. |
| ⬇️⬆️ Money in / out | Big picture buttons: medicine, labour, transport, electricity, loan, interest, animal bought/sold, subsidy, share capital, home use, bank deposit/withdrawal… |
| 📷 Bill photos | Take a photo of any bill; optionally record it as an expense. All bill photos in one gallery. |
| 🛡️ Insurance | Policy, company, start/expiry dates (BS), premium, photo of the policy. Red/orange warning on the home screen 30 days before expiry, phone notifications 30, 7 and 1 day before, and a one-tap **Renew**. |
| 📊 Reports | Daily summary, monthly milk summary, milk by animal, feed cost per animal and per liter, milk money receivable, cash book, ledger. |
| 📒 Accounts | Real double-entry accounts made automatically from every record: **Trial Balance, Income Statement (Profit & Loss), Balance Sheet** by Nepali fiscal year (Shrawan–Ashadh), with opening balances. |
| ☁️ Online | Optional: farmers log in with phone number + 4-digit PIN; records upload automatically to the cooperative's Google Sheet whenever there is internet (the app still works offline). Logging in on a new phone brings all records back. Admin web dashboard shows every farmer's morning/evening milk and fat, amounts, charts, insurance due, and lets the admin reset PINs. Setup: `cloud/SETUP-GUIDE.md`. |
| 💾 Backup | Save all data (including photos) to one file and restore it on any phone. |
| 🔤 Language | Nepali (with Nepali digits) or English, switch any time. |

All data stays on the phone. No internet or account needed.

## Get the APK (free, about 10 minutes, once)

This folder holds the app and the build recipe. GitHub creates the Android project and builds the `.apk` for you automatically:

1. Make a free account at **github.com** and create a new repository (e.g. `setidevi-dairy`).
2. Upload everything in this folder to that repository (**Add file → Upload files**, drag the whole folder content, then **Commit**). Keep the hidden `.github` folder. If your upload tool skips it, create the two files in `.github/workflows/` by hand.
3. Open the **Actions** tab. The job "Build Android APK" starts by itself and takes about 5–8 minutes.
4. When it shows a green ✔, open **Releases → latest** on your phone and tap **SetideviDairy.apk**.
5. Android will ask to allow "Install unknown apps" for your browser. Allow it, then install.

Updating later: change files in the repository, and a new APK appears in Releases → latest. Install it over the old one; your data stays.

## Use it without installing (web app)

Open `www/index.html` from any web server, or turn on GitHub Pages (Settings → Pages → Source: GitHub Actions). In Chrome on Android tap **⋮ → Add to Home screen**. It then works offline like an app.

## First use

1. Pick the language and type your name.
2. Enter the milk rate: rate per fat (e.g. 14.65) and the morning/evening extra (e.g. +7 / +9). The rate is set only in Settings; change it any time and it applies to new entries from then on.
3. Settings → **Opening balances**: enter cash, bank, loans etc. on the day you start.
4. Take a **backup** every week (Settings → Backup) and send the file to yourself on Gmail/Viber.

---

## नेपालीमा छोटो निर्देशन

- **APK बनाउन:** github.com मा निःशुल्क खाता खोल्नुहोस् → नयाँ repository बनाउनुहोस् → यो फोल्डरका सबै फाइल अपलोड गर्नुहोस् → **Actions** मा हरियो ✔ आएपछि फोनबाट **Releases → latest** खोलेर **SetideviDairy.apk** डाउनलोड गरी इन्स्टल गर्नुहोस्।
- **सुरुमा:** भाषा छान्नुहोस्, नाम र दूधको दर (प्रति फ्याट दर, बिहान/बेलुकाको थप) लेख्नुहोस्। दर सेटिङमा मात्र परिवर्तन हुन्छ।
- **दर:** प्रति लिटर दर = फ्याट % × प्रति फ्याट दर + बिहान/बेलुकाको थप।
- **ब्याकअप:** हरेक हप्ता सेटिङ → ब्याकअप गरेर फाइल आफ्नो Gmail/Viber मा पठाउनुहोस्।
- **बीमा:** म्याद सकिनु ३० दिन अगाडि गृहपृष्ठमा रातो/सुन्तला सूचना आउँछ, फोनमा पनि सम्झाउँछ।

## Technical notes

- Plain HTML/CSS/JavaScript in `www/` (no framework), wrapped with Capacitor 8 for Android. The `android/` project is generated during the build (`npx cap add android`); icons come from `assets/`. To build on your own PC instead: `npm ci && npx cap add android && npx @capacitor/assets generate --android && npx cap sync android && npx cap open android` (needs Android Studio).
- Storage: IndexedDB on the phone. Photos are compressed (~150 KB each).
- Plugins: Local Notifications (insurance reminders), Filesystem + Share (backup and report files), App (back button).
- Nepali calendar data in `www/js/bs.js` (BS 2060–2090), checked day by day against the `nepali-date-converter` library.
- Accounts: every milk, feed, money and insurance record posts a balanced debit/credit entry. Income and expense accounts reset each fiscal year (1 Shrawan); earlier profit moves to "Profit of previous years".
