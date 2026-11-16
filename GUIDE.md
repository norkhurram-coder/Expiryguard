# ExpiryGuard – Step-by-step guide (MacBook)

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
1. On GitHub open **github.com/norkhurram-coder/expiryguard** → green **Code** button → copy the HTTPS link.
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
✅ **You should see** `Tests: 12 passed, 12 total`.

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
   ⚠️ Never use the **secret** / **service_role** key in this project.

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
Check **Table Editor**: you now have `profiles`, `suppliers`, `medicines`, `batches`.

### 3.2 Sample data
New query → paste all of `supabase/seed.sql` → **Run**.
✅ `Success`. In **Table Editor → batches** you see 10 rows.

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

1. Click **Create an account**. Fill in the form, choose role **Admin (Owner)** → **Create account**.
✅ You land on the **Expiry Dashboard** with your name and "Admin (Owner)" in the top bar.

2. Open **http://localhost:3000/test-connection**
✅ Green message: *Connected to Supabase! The medicines table has 8 rows you can see.*

Commit: `Connect Supabase and add test page`.

> To stop the server: click in the terminal and press **⌃ C**. Start it again with `npm run dev`.

---

## Step 5 – Sign-up, login and logout

What's built (`components/auth/`):
- **Sign-up**: full name, age, phone, role (dropdown), email, password + confirm. A **live checklist** under the password turns green as each rule is met.
- **Login**: email + password; wrong details show "Wrong email or password".
- **Logout** button in the top bar.

**Test the validation** – on sign-up, try: name `N0or` · age `17` · phone `12345` · email `abc` · password `abc` · different confirm password. Each field shows a red message underneath.

> 💬 **Viva:** "Sign-up and login use Supabase Auth. The forms use React Hook Form with Zod rules, so every field shows a clear red error, the button is disabled while saving, and the password checklist updates live. When a user signs up, a database trigger saves their name, age, phone and role into the profiles table."

---

## Step 6 – Layout and page protection

- **Sidebar**: Dashboard, Medicines, Batches / Stock, Suppliers; greyed-out **Sales (FEFO), Risk Forecast, Reports** marked "Soon". On a phone it becomes a ☰ menu.
- **Top bar**: name, role, Log out.
- **`proxy.ts`** runs before every page: it refreshes the login session and sends logged-out users to `/login`.

Test: click **Log out**, then type `http://localhost:3000/medicines` → you are sent back to login.

> 💬 **Viva:** "Every page is protected by the Next.js proxy, which checks the Supabase session before the page loads and redirects logged-out users to the login page. The sidebar shows only the pages the user's role is allowed to use, and features for the next milestone are shown as Coming soon."

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

## Step 11 – Role-based access (FR-16 basics)

1. Log out → sign up a second account as **Pharmacist** (use a different email).
   ✅ Can add and edit, but there are **no Delete** buttons.
2. Log out → sign up a third account as **Sales Staff**.
   ✅ **Suppliers** is missing from the sidebar, tables say **View only**, and opening `/medicines/new` sends you back to the dashboard with "Your role does not have access".

> 💬 **Viva:** "Access is controlled in two layers. The interface hides buttons and pages a role can't use, but the real protection is Row Level Security in the database: even if Sales Staff tried to insert data directly, PostgreSQL would reject it. Admin can do everything, Pharmacist can add and edit, and Sales Staff can only view stock."

> Note for the viva: in this milestone users choose their role at sign-up so it's easy to demo. In the final version, only the Admin should assign roles.

---

## Step 12 – Tests

```bash
npm test
```
✅ `12 passed`. These cover expiry bands, FEFO selection, average daily sales, the proposal's example (**120 left, 2/day, 45 days → 30 at risk**), and the last return date.

> 💬 **Viva:** "The core formulas are pure functions in `lib/expiry.ts`, so they can be tested with Jest without a database. The tests check the expiry bands, FEFO batch selection, the expected unsold formula using the example from my proposal, and the supplier return deadline."

---

## Step 13 – Deploy to Vercel

1. Commit and push everything first.
2. Go to **vercel.com** → **Sign up** with **GitHub**.
3. **Add New… → Project** → find **expiryguard** → **Import**.
4. Open **Environment Variables** and add both:
   - `NEXT_PUBLIC_SUPABASE_URL` = your URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your key
5. Click **Deploy**. After ~1–2 minutes you get a link like `expiryguard-xxxx.vercel.app`.
6. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel link → Save.

✅ Open the Vercel link, log in, and the dashboard works online. Every future `git push` redeploys automatically.

---

## Final checklist before evaluation

**Setup**
- [ ] `npm test` → 12 passed
- [ ] App runs locally and on Vercel
- [ ] `.env.local` is NOT on GitHub
- [ ] README progress table is up to date

**Validation (try wrong inputs on every form)**
- [ ] Sign-up: bad name, age 17 / 71 / 20.5, phone `0300123`, bad email, weak password, mismatched confirm
- [ ] Login: empty fields, wrong password
- [ ] Supplier: 1-letter name, return window 400, bad phone
- [ ] Medicine: empty dropdowns, rack `A 3!`, minimum stock `-5` or `2.5`
- [ ] Batch: **past/today expiry date**, quantity 0, price `1.234`, sale < purchase (warning only)

**CRUD (as Admin)**
- [ ] Add, search, edit and delete a supplier, a medicine and a batch
- [ ] Deleting a medicine that has batches shows a friendly error
- [ ] Every delete asks for confirmation

**Roles**
- [ ] Pharmacist: can add/edit, no delete
- [ ] Sales Staff: no Suppliers page, view only, blocked from `/medicines/new`
- [ ] Logged out: every page redirects to login

**Dashboard**
- [ ] Counters, near-expiry table, quarantine list and low-stock list all show seed data
- [ ] Works on phone (open the Vercel link on your phone)

---

## Demo script for Sir Waqas (about 5 minutes)

1. **Problem (20 s):** "Small pharmacies check expiry dates by eye. Expired medicines get sold and stock expires unnoticed. ExpiryGuard tracks every batch and warns early."
2. **Login (30 s):** Show the sign-up form. Type a weak password and point at the live checklist. Log in as Admin.
3. **Dashboard (60 s):** "This is live data from Supabase." Point to the 4 counters, the colour badges, the last return date column, the quarantine list ("expired stock can't be sold") and low stock ("Softin is out of stock").
4. **Suppliers (30 s):** Add a supplier, enter phone `123` to show the error, fix it, save → success message.
5. **Medicines (30 s):** Add a medicine, show the dropdowns and search.
6. **Batch – the key feature (60 s):** Add a batch with **yesterday's date** → "Expiry date must be after today". Explain: "FR-03 is checked in the form and again by a database trigger." Enter a valid date, set sale price below purchase price → warning. Save → it appears on the dashboard.
7. **Roles (45 s):** Log in as Sales Staff: no Suppliers page, view only. "Row Level Security in the database enforces this, not just the buttons."
8. **Tests (20 s):** Run `npm test` → 12 passed. "Including the 120 tablets, 2 a day, 45 days → 30 at risk example from my proposal."
9. **Next milestone (15 s):** Point to the greyed-out Sales (FEFO), Risk Forecast and Reports. "The FEFO and forecast formulas are already written and tested."

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
