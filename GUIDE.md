# ExpiryGuard – Step-by-step guide (final version)

> Written for a MacBook. On Windows use **Ctrl** instead of **⌘**, and `copy` instead of `cp` in Command Prompt (Git Bash and PowerShell accept `cp`).

Follow the steps in order. Each step tells you **what you should see**. If anything looks different or shows an error, stop and send a screenshot before moving on.

All commands go in **VS Code's terminal** (Terminal → New Terminal). Press Enter after each line.

---

## Step 1 – Tools and project files

### 1.1 Check Node.js
```bash
node -v
npm -v
```
✅ **You should see** a version for each, e.g. `v24.11.0` and `11.6.2`.
❌ If you see `command not found`: go to **nodejs.org**, download the **LTS** version for macOS, install it, then quit VS Code (⌘ Q), reopen it and try again.

### 1.2 VS Code extensions
Press **⌘ ⇧ X** and install:
- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **Prettier – Code formatter**

### 1.3 Clone your expiryguard repository
1. On GitHub open **your expiryguard repository** → green **Code** button → copy the HTTPS link.
2. In VS Code press **⌘ ⇧ P**, type **Git: Clone**, Enter, paste the link, Enter.
3. Choose your **Documents** folder → **Select as Repository Destination** → click **Open**.

✅ VS Code opens a folder called `expiryguard` with only `README.md` in it.

### 1.4 Copy the project files into it
1. Unzip `expiryguard.zip` (double-click it in Downloads). You get a folder `expiryguard` inside Downloads.
2. In VS Code's terminal (it is already inside your cloned folder), run:
```bash
cp -R ~/Downloads/expiryguard/. .
```
This copies everything, including hidden files like `.gitignore` and `.env.example` (Finder hides files that start with a dot – press **⌘ ⇧ .** in Finder to see them).

> If you unzipped somewhere else, change `~/Downloads/expiryguard` to that path.

✅ The Explorer now shows `app`, `components`, `lib`, `supabase`, `tests`, `package.json`, `GUIDE.md` and more.

### 1.5 Install the packages
```bash
npm install
```
✅ Takes 1–2 minutes and ends with something like `added 400 packages`. A new `node_modules` folder appears (it is ignored by Git).

### 1.6 Run the logic tests
```bash
npm test
```
✅ **You should see** `Tests: 34 passed, 34 total`.

### 1.7 First commit
```bash
git add .
git commit -m "Add ExpiryGuard 40% milestone code"
git push
```
✅ Refresh your repository on GitHub: all the folders are there. Make sure there is **no** `.env.local` and **no** `node_modules` on GitHub.

### Git words in simple English
- **Repository:** the project folder that Git tracks, with all its history.
- **Commit:** a saved snapshot of your changes with a message.
- **Push:** upload your commits to GitHub. **Pull:** download the latest commits from GitHub.
- **.gitignore:** a list of files Git must never upload, like `node_modules` and your secret `.env.local`.

> From now on, after each step that changes something: **Source Control (⌃ ⇧ G) → type a message → Commit → Sync Changes**. Same as `git add .`, `git commit -m "..."`, `git push`.

---

## Step 2 – Connect Supabase

### 2.1 Create the Supabase project
1. Go to **supabase.com** → **Start your project** → sign in with **GitHub**.
2. **New project** → name `expiryguard` → set a database password (save it somewhere) → Region: the closest one to Pakistan (e.g. **Mumbai** or **Singapore**) → **Create new project**.
3. Wait 1–2 minutes until it says the project is ready.

### 2.2 Copy your URL and key
1. In your project click **Project Settings** (gear icon, bottom left) → **API Keys** – or the **Connect** button at the top of the project page.
2. Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
3. Copy the **publishable key** (starts with `sb_publishable_…`) – or, under **Legacy API keys**, the **anon public** key. Either works.
   ⚠️ Never put the **secret** / **service_role** key in a `NEXT_PUBLIC_` variable. It is only used on the server by the daily scan (Step 16 and 19).

### 2.3 Create `.env.local`
```bash
cp .env.example .env.local
```
Open `.env.local` in VS Code and replace the two values with yours:
```
NEXT_PUBLIC_SUPABASE_URL=https://abcdxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
```
Save (⌘ S). This file is listed in `.gitignore`, so it is never pushed. Check: in Source Control, `.env.local` must **not** appear in the list of changes.

### 2.4 Turn off "Confirm email" (for development)
Supabase → **Authentication** → **Sign In / Providers** → **Email** → switch **Confirm email** OFF → **Save**.
Now sign-up logs you in straight away instead of sending a confirmation email.

> 💬 **Viva:** "Supabase is our backend: a PostgreSQL database plus login. The app connects using the project URL and a public key stored in `.env.local`, which is never uploaded to GitHub. The public key is safe in the browser because Row Level Security in the database decides what each user can see."

---

## Step 3 – Create the database

### 3.1 Tables, rules and security
1. Supabase → **SQL Editor** → **New query**.
2. In VS Code open `supabase/schema.sql`, select all (⌘ A), copy (⌘ C), paste into the SQL Editor, click **Run**.

✅ **You should see** `Success. No rows returned`.
Check **Table Editor**: you now have `profiles`, `suppliers`, `medicines`, `batches`, `sales`, `sale_items`, `stock_movements` and `scan_runs`.

### 3.2 Sample data
New query → paste all of `supabase/seed.sql` → **Run**.
✅ `Success`. In **Table Editor → batches** you see 10 rows, and **sales** has 60 rows (sample sales for the last 60 days, used by the forecast).

### What the script does
- **CHECK constraints** repeat the form rules in the database (e.g. phone must match `03XXXXXXXXX`), so bad data can't get in even if someone skips the form.
- **Trigger `check_batch_expiry`** rejects any batch whose expiry date is today or earlier (**FR-03**).
- **Trigger `on_auth_user_created`** creates a `profiles` row (name, age, phone, role) when someone signs up.
- **Row Level Security (RLS):**

| | View | Add / edit | Delete |
|---|---|---|---|
| Admin | everything | everything | everything |
| Pharmacist | medicines, batches, suppliers | medicines, batches, suppliers | ✗ |
| Sales Staff | medicines, batches | ✗ | ✗ |

> ⚠️ **Most common beginner problem:** if RLS is ON and a table has **no policy**, the app sees an **empty table** – no error, just nothing. If a page is unexpectedly empty, check the policies (Authentication → Policies) or that you ran the whole `schema.sql`.

> 💬 **Viva:** "The database has four tables: profiles, suppliers, medicines and batches. Stock is stored per batch because each batch has its own expiry date. CHECK constraints and a trigger stop invalid data and past expiry dates at database level, and Row Level Security policies decide what each role can read or change."

---

## Step 4 – Run the app and test the connection

```bash
npm run dev
```
Open **http://localhost:3000**.
✅ You are sent to the **login page** (all pages are protected).

1. Click **Create an account**. Fill in the form → **Create account**. The **first** account automatically becomes **Admin (Owner)**.
✅ You land on the **Expiry Dashboard** with your name and "Admin (Owner)" in the top bar.

2. Open **http://localhost:3000/test-connection**
✅ Green message: *Connected to Supabase! The medicines table has 8 rows you can see.*



> To stop the server: click in the terminal and press **⌃ C**. Start it again with `npm run dev`.

---

## Step 5 – Sign-up, login and logout

What's built (`components/auth/`):
- **Sign-up**: full name, age, phone, email, password + confirm (no role – see Step 11). A **live checklist** under the password turns green as each rule is met.
- **Login**: email + password; wrong details show "Wrong email or password".
- **Logout** button in the top bar.

**Test the validation** – on sign-up, try: name `N0or` · age `17` · phone `12345` · email `abc` · password `abc` · different confirm password. Each field shows a red message underneath.

> 💬 **Viva:** "Sign-up and login use Supabase Auth. The forms use React Hook Form with Zod rules, so every field shows a clear red error, the button is disabled while saving, and the password checklist updates live. When a user signs up, a database trigger saves their name, age and phone into the profiles table and gives them a role – Admin for the very first user, Sales Staff for everyone else."

---

## Step 6 – Layout and page protection

- **Sidebar** in three groups – *Daily work*: Dashboard, Sales (FEFO), Medicines, Batches / Stock, Suppliers · *Expiry control*: Risk Forecast, Alerts & Daily Scan, Reports · *Admin*: Users & Roles, Audit Log. Each role only sees its own pages. On a phone it becomes a ☰ menu.
- **Top bar**: name, role, Log out.
- **`proxy.ts`** runs before every page: it refreshes the login session and sends logged-out users to `/login`.

Test: click **Log out**, then type `http://localhost:3000/medicines` → you are sent back to login.

> 💬 **Viva:** "Every page is protected by the Next.js proxy, which checks the Supabase session before the page loads and redirects logged-out users to the login page. The sidebar shows only the pages the user's role is allowed to use, and each page also checks the role on the server."

---

## Step 7 – Suppliers (add, view, edit, delete)

**Suppliers → + Add supplier**. Rules: name 2–100 characters · contact person letters only · phone `03XXXXXXXXX` · valid email · return window 0–365 whole days.

Test: add a supplier, search for it, edit it, delete it (asks "Are you sure?" first). Try a return window of `400` → red error.

> 💬 **Viva:** "Suppliers are stored with a return window in days, which we use to calculate the last date a near-expiry batch can be returned: expiry date minus the return window. The form validates every field with Zod and the table has search, edit and delete with a confirmation. Only Admin and Pharmacist can see suppliers."

---

## Step 8 – Medicines (FR-01)

**Medicines → + Add medicine**: brand name, generic name, strength, dosage form and category (dropdowns), rack location (optional, like `A-3`), minimum stock level.

Test: add `Augmentin 1 g tablet`; try rack `A 3!` → error; try adding the same brand + strength + form twice → "already exists".
The **In stock** column adds up all non-expired batches, with an orange **Low** badge under the minimum.

> 💬 **Viva:** "A medicine is saved once in the catalogue with its brand, generic name, strength, form, category and minimum stock level. Stock itself is not stored on the medicine; it is calculated from its batches, ignoring expired ones. If that total is below the minimum level, the medicine is flagged as low stock."

---

## Step 9 – Batches / purchase entry (FR-02, FR-03)

**Batches / Stock → + Add batch**: medicine and supplier (dropdowns), batch number, expiry date, quantity, purchase and sale price.

Test:
- Expiry date **today or in the past** → red error *"Expiry date must be after today"* (the date picker also blocks past dates; and the database trigger rejects it as a second safety net).
- Sale price lower than purchase price → orange **warning**, but you can still save.
- Price `1.234` → "at most 2 decimal places".

Expired batches show a red **Quarantined** badge and cannot be edited, only deleted by Admin.

> 💬 **Viva:** "Each purchase is saved as a batch with its own batch number, expiry date, quantity and prices. FR-03 is enforced twice: the form rejects any expiry date that is not after today, and a database trigger rejects it again even if the form is bypassed. Expired batches are quarantined, so they can't be edited back into stock."

---

## Step 10 – Expiry dashboard (FR-07, FR-13, FR-14)

The dashboard now reads **live data** from Supabase:
- 4 counters: **Expired · Within 30 · Within 60 · Within 90 days**
- **Near-expiry table** with colour badges (red expired, orange 30, yellow 60, teal 90) and the **last return date** from the supplier's return window
- **Quarantine list** of expired batches ("Do not sell")
- **Low-stock list** (including "Out of stock")

> 💬 **Viva:** "The dashboard loads all batches from Supabase and uses our tested functions in `lib/expiry.ts` to put each batch in a band: expired, 30, 60 or 90 days. Expired batches appear in the quarantine list so they are not sold, and medicines whose non-expired stock is below the minimum level appear in the low-stock list."

Commit: `Dashboard uses live Supabase data`.

---

## Step 11 – Role-based access (FR-16)

In the final version **nobody chooses their own role** (that was a security hole – anyone could sign up as Admin):
- The **first** account that signs up becomes **Admin (Owner)** automatically.
- Everyone after that starts as **Sales Staff**.
- The Admin opens **Users & Roles** and changes the role from the dropdown. The last Admin can never be demoted (a database trigger stops it).

Test:
1. Log out → sign up a second account (different email) → it is **Sales Staff**: the sidebar only shows **Sales (FEFO), Medicines, Batches / Stock**. Opening `/forecast` or `/medicines/new` sends you back to the sales screen with "Your role does not have access".
2. Log in as Admin → **Users & Roles** → make that account **Pharmacist** → log in as it: you can add and edit, but there are **no Delete** buttons, and no Users / Audit Log pages.

> 💬 **Viva:** "Access is controlled in two layers. The interface hides pages and buttons a role can't use, but the real protection is Row Level Security in the database: even if Sales Staff sent a request directly, PostgreSQL would reject it. Roles are assigned only by the Admin – the sign-up form has no role field, and a trigger makes the first user the Admin."

---

## Step 12 – Tests

```bash
npm test
```
✅ `Tests: 34 passed, 34 total` in 5 test files:

| File | What it checks |
|---|---|
| `tests/expiry.test.ts` | expiry bands, FEFO picking across several batches, expired stock never sold, the forecast incl. the proposal example (**120 left, 2/day, 45 days → 30 at risk**), return dates |
| `tests/analysis.test.ts` | the three scan tasks (expiry, low stock, forecast) and the "missed day" logic (NFR-04) |
| `tests/threads.test.ts` | starts **real worker threads** and proves they run on different threads and give exactly the same result as one thread |
| `tests/reports.test.ts` | monthly loss value, stock value by expiry band, top sellers |
| `tests/email.test.ts` | the daily email summary |

> 💬 **Viva:** "All business rules are pure functions, so Jest can test them without a database. The thread test starts a real pool of worker threads and checks that the parallel result equals the single-thread result – so multithreading made it faster without changing the answer."

---

## Step 13 – Update the database for the final version

If you set up Supabase for the 40% milestone, run the new scripts again (they are safe to re-run and keep your data):
1. Supabase → **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
2. New query → paste all of `supabase/seed.sql` → **Run** (adds barcodes and 60 days of sample sales).

✅ **Table Editor** now also shows `sales`, `sale_items`, `stock_movements` and `scan_runs`.

New in the database:
- **`process_sale`** – the checkout function: FEFO, expired-sale block and row locks (Step 14).
- **`write_off_batch`** – dispose of expired stock or return it to the supplier (Step 15).
- **Audit trigger** – every change to a batch writes a row in `stock_movements` (Step 18).
- **`scan_runs`** – history of the daily scan (Step 16).

---

## Step 14 – Sales with FEFO (FR-04, FR-05, FR-06, NFR-05)

Open **Sales (FEFO)** (every role has it).
1. Type `Panadol` (or scan / type the barcode `8964000100011` and press **Enter**) → it goes into the cart.
2. Set the quantity to **130**. The screen shows the FEFO plan: **120 from PN-2409** (earliest expiry) **+ 10 from PN-2503**, an orange **"Expires in 20 days"** warning (FR-06), and a red **"Blocked: PN-2401 (expired)"** line (FR-05).
3. Add Augmentin and Risek → **Complete sale** → a receipt appears and the stock goes down. The sale appears under "Today's sales".
4. Try a quantity bigger than the in-date stock → "Not enough in-date stock" and the button is disabled.

**Concurrency (important for the viva):** the real sale is done by the database function `process_sale`. It locks the batch rows (`SELECT … FOR UPDATE`) while it saves the sale, so if two counters sell the last packs at the same moment, the second waits for the first and then sees the new quantity – stock can never go below zero. The whole sale is one transaction: if any item fails, nothing is saved.

> 💬 **Viva:** "When a medicine is added, the system picks the batch that expires first – First-Expiry-First-Out – and moves to the next batch if one isn't enough. Expired batches are filtered out in the database, so Sales Staff can't sell them even if they try. The checkout function locks the rows it changes, which prevents a race condition when two sales happen at the same time."

---

## Step 15 – Risk Forecast and supplier returns (FR-09 – FR-12)

Open **Risk Forecast** (Admin / Pharmacist).
- **Average per day** = units sold in the last 60 full days ÷ 60 (FR-09).
- **Unsold at expiry** = stock left − (average per day × days left) (FR-10). Augmentin AG-2407 shows the proposal example: **120 left, 2/day, 45 days → 30 at risk**.
- **Last return date** = expiry − supplier's return window (FR-11). If it hasn't passed, the action is **Return** (with a button); otherwise **Discount / promote**.
- The yellow box lists **return deadlines in the next 7 days** (FR-12) – the seed data has Calpol CP-2408 due in 5 days. The same list is on the dashboard.
- **FEFO-aware:** when a medicine has several batches, a later batch only starts selling after the earlier one is sold out, so its risk isn't underestimated.
- The card at the bottom shows the **worker threads** that calculated the page (Step 17).

On the dashboard, the **Quarantine** list now has a **Dispose** button (expired stock only) and return deadlines have a **Return** button. Both set the stock to 0 and write the reason to the audit log. A return after the supplier's deadline is refused by the database.

> 💬 **Viva:** "The forecast combines expiry dates with sales speed. Using my proposal's example: 120 tablets, selling 2 a day, 45 days left → 90 will sell, so 30 are at risk, and the pharmacist is told to return them before the supplier's last return date."

---

## Step 16 – Daily scan and email alerts (FR-07, FR-08, NFR-04)

Open **Alerts & Daily Scan**. As Admin press **Run scan now**.
✅ A green message: *Scan finished … 1 expired · 1 return deadline(s) · … email skipped – SMTP is not set up*. The run appears in the history table.

Every morning at **08:00 Pakistan time** (03:00 UTC, see `vercel.json`) Vercel Cron calls `/api/cron/daily-scan`, which does the same scan automatically and emails the owner.

**Missed days (NFR-04):** each run remembers the last *successful* run. If a run fails (or the server was down), the next run covers the missed days too – batches that expired on those days are reported as "newly expired", and return deadlines that passed are marked **MISSED**. A failed run is shown in red on the dashboard and on this page.

**Email setup (optional, Gmail):** Google Account → Security → 2-Step Verification ON → **App passwords** → create one. Then in `.env.local` (and on Vercel):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=yourname@gmail.com
SMTP_PASS=the 16-letter app password
```
Restart `npm run dev` and run the scan again → *email sent to …*. Without SMTP the scan still works; the email is just "skipped".

> 💬 **Viva:** "A Vercel Cron job runs the scan every morning. It lists expired, 30, 60 and 90-day batches, return deadlines, low stock and stock that won't sell in time, and emails it with Nodemailer. Each run is saved, so if one fails the next run also covers the missed days, and the failure is shown on the dashboard."

---

## Step 17 – Multithreading (the main requirement)

ExpiryGuard uses threads in three places:

| Where | What happens | Files |
|---|---|---|
| **Server: daily scan + forecast** | A **thread pool** of Node.js `worker_threads` (one per CPU core, max 4). The analysis is split into tasks – *expiry scan*, *stock check*, *forecast part 1*, *forecast part 2* – that run **at the same time** on different threads. The main thread waits for all of them and merges the results. | `lib/threads/pool.ts`, `lib/threads/analysis-worker.ts`, `lib/analysis.ts` |
| **Browser: dashboard** | Two **Web Workers** (Expiry Scanner + Stock Checker) scan the stock while the page keeps responding – the "ticks" counter keeps going. | `components/BackgroundScan.tsx`, `public/workers/` |
| **Database: checkout** | Row locks (`FOR UPDATE`) make concurrent sales safe – the classic race-condition problem. | `process_sale` in `supabase/schema.sql` |

How the pool works (point at `lib/threads/pool.ts`):
1. `buildTasks()` splits the work into independent tasks.
2. `runTasksInPool()` starts N worker threads. Each thread takes the next task from a shared queue, runs it, sends the result back with `postMessage`, and takes another task until the queue is empty.
3. Threads share **no memory** – each gets a copy of the data – so no locks are needed and there are no race conditions.
4. If threads can't start, the same tasks run one after another on the main thread ("single" mode), so the scan never breaks.

See it working: **Risk Forecast** (bottom card) or **Alerts & Daily Scan** → "How the last scan used multithreading" shows each task with its **thread number** and time. `npm test` → `tests/threads.test.ts` proves 4 different threads were used and the result equals the single-thread result.

> 💬 **Viva:** "JavaScript normally runs on one thread. For the daily scan I built a small thread pool with Node's worker_threads: the scan is split into independent tasks that run in parallel on different CPU cores, communicating only by messages, so there's no shared state to lock. In the browser, two Web Workers do the background scan without freezing the page. And in the database, the checkout locks the rows it changes so two sales at the same moment can't oversell stock."

---

## Step 18 – Reports, audit log and backup (FR-15, NFR-06, NFR-07)

- **Reports** (Admin / Pharmacist): choose a month → **expired-stock loss**, **near-expiry stock value**, sales, value saved by supplier returns, **top-selling medicines** (Chart.js bar chart), loss over the last 6 months, stock value by expiry and low stock. **Print / PDF** saves a copy.
- **Audit Log** (Admin): every stock change – purchase, sale, edit, disposal, return, delete – with the user and time. It is written by a database trigger, so nothing can skip it. Filter by type at the top.
- **Download backup** (Admin, on the Reports page): a JSON file with all the pharmacy data. Supabase also keeps its own daily database backups.

> 💬 **Viva:** "Every stock change is logged by a trigger on the batches table with the user and the time, which meets NFR-06. The monthly report shows the money lost to expiry – stock that expired in that month, whether still in quarantine or already disposed of – while stock returned to the supplier is not counted as a loss."

---

## Step 19 – Deploy to Vercel

1. Push everything to GitHub first.
2. Go to **vercel.com** → **Sign up** with **GitHub**.
3. **Add New… → Project** → find **expiryguard** → **Import**.
4. Open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your publishable / anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API Keys → **secret / service_role** key. ⚠️ Only here and in `.env.local` – it is used on the server by the cron job and never reaches the browser.
   - `CRON_SECRET` = any long random text (e.g. from a password generator)
   - Optional email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ALERT_EMAIL_TO`, `APP_URL`
5. Click **Deploy**. After ~1–2 minutes you get a link like `expiryguard-xxxx.vercel.app`.
6. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel link → Save.
7. Vercel → your project → **Settings → Cron Jobs**: you should see `/api/cron/daily-scan` at `0 3 * * *`. Press **Run** to test it, then check **Alerts & Daily Scan**.

✅ Open the Vercel link, log in, and everything works online. Every future `git push` redeploys automatically.

---

## Final checklist before evaluation

**Setup**
- [ ] `npm test` → 34 passed
- [ ] App runs locally and on Vercel; `schema.sql` and `seed.sql` run on Supabase
- [ ] `.env.local` is NOT on GitHub
- [ ] Cron job visible in Vercel → Settings → Cron Jobs

**Validation (try wrong inputs on every form)**
- [ ] Sign-up: bad name, age 17 / 71 / 20.5, phone `0300123`, bad email, weak password, mismatched confirm
- [ ] Login: empty fields, wrong password
- [ ] Supplier: 1-letter name, return window 400, bad phone
- [ ] Medicine: empty dropdowns, rack `A 3!`, minimum stock `-5` or `2.5`, barcode `ab`
- [ ] Batch: **past/today expiry date**, quantity 0, price `1.234`, sale < purchase (warning only)

**Sales & expiry**
- [ ] Sale of 130 Panadol uses PN-2409 then PN-2503; expired PN-2401 shown as blocked
- [ ] Barcode + Enter adds an item; too large a quantity disables "Complete sale"
- [ ] Forecast shows Augmentin AG-2407 → 30 at risk
- [ ] Dispose a quarantined batch, return Calpol CP-2408 → both appear in the Audit Log
- [ ] Run scan now → success; history row appears
- [ ] Reports show charts for this month

**Roles**
- [ ] First account = Admin; new accounts = Sales Staff
- [ ] Sales Staff: only Sales, Medicines, Batches; blocked from `/forecast` and `/medicines/new`
- [ ] Pharmacist: add/edit, returns/disposal, no delete, no Users / Audit Log
- [ ] Logged out: every page redirects to login

---

## Demo script for Sir Waqas (about 8 minutes)

1. **Problem (20 s):** "Small pharmacies check expiry dates by eye. Expired medicines get sold and stock expires unnoticed. ExpiryGuard tracks every batch, sells the oldest first and warns early."
2. **Login & roles (40 s):** Show the sign-up form (live password checklist, no role field). Log in as Admin → **Users & Roles**: "Only the Admin assigns roles."
3. **Dashboard (45 s):** 4 counters, return deadline this week (Calpol), quarantine with **Dispose**, low stock. "All live from Supabase."
4. **Batch entry (30 s):** Add a batch with yesterday's date → rejected (FR-03, form + database trigger).
5. **Sales – key feature (75 s):** Sell 130 Panadol: FEFO plan across two batches, 30-day warning, expired batch blocked. Complete the sale → receipt. "The database function locks the rows, so two counters can't oversell."
6. **Forecast (60 s):** Augmentin: "120 left, 2 a day, 45 days → 30 at risk – return before the last return date." Point at the thread card.
7. **Multithreading (60 s):** **Alerts & Daily Scan → Run scan now**: tasks on different thread numbers. Then the dashboard's browser **Background scan** with the ticks counter. Explain the pool in `lib/threads/pool.ts`.
8. **Reports & audit (40 s):** Monthly loss, top sellers chart, Audit Log shows the sale and disposal you just did.
9. **Sales Staff (20 s):** Log in as Sales Staff: only the sales screen and stock lookup. "Row Level Security enforces this."
10. **Tests (20 s):** `npm test` → 34 passed, including the real worker-thread tests.

---

## If something goes wrong

| Problem | Fix |
|---|---|
| `Invalid supabaseUrl` or "fetch failed" | `.env.local` values are wrong or missing. Fix them and restart `npm run dev`. |
| Pages are empty, no errors | RLS with no policy, or `schema.sql` not fully run. Run it again. |
| "Database error saving new user" on sign-up | `schema.sql` wasn't run before signing up, or a field broke a rule. Run the script again. |
| Yellow banner "Your profile was not found" | You signed up before running `schema.sql`. Delete the user in Supabase → Authentication → Users and sign up again. |
| `Port 3000 is in use` | Another `npm run dev` is running. Close that terminal or press ⌃ C there. |
| `npm: command not found` | Install Node.js LTS (Step 1.1) and restart VS Code. |
| "Could not find the function public.process_sale" or missing tables | The final `schema.sql` hasn't been run yet. Run it again in the SQL Editor (Step 13). |
| Daily scan says "SUPABASE_SERVICE_ROLE_KEY is not set" | Add the secret / service_role key on Vercel (Step 19) and redeploy. "Run scan now" works without it. |
| Email status "skipped – SMTP is not set up" | Normal without email settings. Add the SMTP values (Step 16) to send real emails. |
| Email status "failed – Invalid login" | Gmail needs an **App Password**, not your normal password. |
| Thread card says "main thread" instead of thread numbers | Worker threads couldn't start (needs Node.js 22.18 or newer). Check `node -v`; the scan still works in single mode. |
