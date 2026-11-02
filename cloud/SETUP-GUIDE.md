# Setidevi Dairy — put the data online (Google Sheets)

You do this **once**, on a computer, with the cooperative's Gmail account. It takes about 15 minutes.
You need two files from this folder: **Code.gs** and **Dashboard.html**.

## 1. Make the Google Sheet
1. Go to **sheets.google.com** and sign in with the cooperative's Gmail.
2. Click **Blank spreadsheet**. Rename it (top left) to **Setidevi Dairy Data**.

## 2. Add the server program
1. In the sheet, click **Extensions → Apps Script**. A new tab opens.
2. Rename the project (top left, "Untitled project") to **Setidevi Dairy**.
3. You see a file **Code.gs** with a few lines in it. Delete everything in it.
4. Open **Code.gs** from this folder in Notepad, select everything (Ctrl+A), copy (Ctrl+C), and paste (Ctrl+V) into the Apps Script editor.
5. Click the **+** next to "Files" → **HTML**. Name it exactly **Dashboard** (Apps Script adds ".html" itself).
6. Delete everything in the new file, then copy-paste everything from **Dashboard.html** (from this folder) into it.
7. Click the **Save** icon 💾.

## 3. Publish it (deploy)
1. Click the blue **Deploy** button (top right) → **New deployment**.
2. Click the ⚙️ gear next to "Select type" → **Web app**.
3. Fill in:
   - Description: `Setidevi Dairy`
   - Execute as: **Me**
   - Who has access: **Anyone**  ← important, or the phones cannot send data
4. Click **Deploy**.
5. Google asks for permission: **Authorize access** → choose your Gmail → you will see "Google hasn't verified this app". Click **Advanced** → **Go to Setidevi Dairy (unsafe)** → **Allow**. (This warning appears because you wrote the program yourself; it only gets access to this one sheet.)
6. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…/exec`.

## 4. Create the admin password
1. Open the Web app URL in your browser. The **admin dashboard** opens.
2. It asks you to **create an admin password** (at least 6 letters). Keep it secret; anyone with the link and the password can see all farmers' records.
3. Bookmark this page. This is where you see all reports.

## 5. Send the URL to Claude
Send the Web app URL. It is then built into the app, so farmers never have to type it, and you get a new APK.

(Until then, farmers can type the address themselves: app → Settings → ☁️ Online → "Server address".)

## 6. Farmers join
On each farmer's phone: **Settings → ☁️ Online → New account** → phone number, name, a 4-digit PIN (twice) → ✔.
Records then upload by themselves whenever there is internet.
On a new or replaced phone: **Log in** with the same phone number and PIN, and all records come back.

## Everyday use for the admin
- **Overview**: milk sold per day (☀️ morning / 🌙 evening), average fat, top farmers.
- **By farmer**: each farmer's morning and evening liters and fat, amount, money received, milk produced, feed cost, last upload time. Click a farmer to see only them.
- **Daily**, **Milk records**: every sale with date, shift, liters, fat, rate, amount.
- **Insurance**: every farmer's policies, with expired and soon-expiring ones on top.
- **Accounts**: reset a forgotten PIN, turn an account off, change the admin password.
- **⬇ Excel (CSV)** on each table downloads it for Excel.
- The raw data is also in the Google Sheet tabs (Farmers, Milk, Production, Feed, Money, Insurance, Animals, Bills). Do not edit or reorder those columns by hand.

## Updating the server program later
Paste the new code, save, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same.

## Good to know
- Free: Google Sheets and Apps Script cost nothing at this size (hundreds of farmers).
- Photos (bills, animals) stay on each phone; only the records go online.
- A PIN locks for 15 minutes after 5 wrong tries.
