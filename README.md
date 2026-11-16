# ExpiryGuard

**Smart Pharmacy Stock & Expiry Management System** – *Sell safe stock. Lose less to expiry.*

**Live demo:** https://expiryguard-lyart.vercel.app

Noor-ul-Haya · F24-BSSE-105 · Section 5B · Software Construction & Development · Instructor: Sir Waqas

ExpiryGuard records every medicine by batch and expiry date, sells the earliest-expiring batch first (FEFO), blocks expired stock at checkout and warns 90/60/30 days before expiry.

## Tech stack

Next.js + Tailwind CSS · Supabase (PostgreSQL, Auth, Row Level Security) · React Hook Form + Zod · Web Workers · Jest · Vercel

## 50% milestone

| Requirement | Done |
|---|---|
| UI (50%, well designed) | Login, Sign-up, Dashboard, Sales, Medicines, Batches, Suppliers (list, add, edit) |
| Database + validation for all forms | All 6 forms save to Supabase and are validated with Zod (`lib/validation.ts`) and database CHECK rules |
| 2 design patterns | Factory + Singleton (see below) |
| Threads | Parallel expiry scan with Web Workers (see below) |

**Next milestones:** risk forecast, daily email alerts, monthly reports.

## Multithreading

**Where to see it:** Dashboard → **Parallel expiry scan** → choose 1, 2 or 4 threads → **Run parallel scan**.

The batches are split into chunks, and each chunk is checked on its own background thread (Web Worker) **at the same time**. Each thread has its own progress bar, and the "main thread responsive" counter keeps ticking, which shows the page doesn't freeze. The card also shows the time taken and the speed-up.

| File | What it does |
|---|---|
| `public/workers/expiry-scanner.js` | The thread: calculates days to expiry for its chunk and sends the results back with `postMessage` |
| `lib/threads/WorkerPool.ts` | Thread pool: starts up to 4 threads, runs tasks in parallel, reuses threads, queues extra tasks |
| `components/scan/ParallelExpiryScan.tsx` | Splits the batches into chunks, runs them on the pool, shows the progress bars and results |

## Design patterns

### 1. Factory – `lib/patterns/ExpiryAlertFactory.ts`
`ExpiryAlertFactory.create(expiryDate)` decides which alert object to create: **Expired, ≤30 days, ≤60 days, ≤90 days or Safe**. Each object knows its colour, its priority, whether it can be sold and what advice to give. Screens never use `new` or repeat if/else checks.

Used in: `components/ui/Badge.tsx`, `app/(app)/page.tsx` (dashboard), `components/sales/Checkout.tsx` (blocks expired stock), `components/scan/ParallelExpiryScan.tsx`.

### 2. Singleton – `lib/threads/WorkerPool.ts` and `lib/supabase/client.ts`
The constructor is `private`, so the only way to get the object is `getInstance()`, which always returns the **same one**.
- `WorkerPool.getInstance()`: the whole app shares one thread pool, so no screen can start extra threads by mistake.
- `SupabaseBrowser.getInstance()`: the browser opens only one database connection.

*Bonus – Object Pool:* `WorkerPool` reuses its threads instead of starting new ones for every scan.

## Sales with FEFO

Sales screen (`/sales`): for every item in the cart it shows which batch each unit will come from, earliest expiry first. Expired batches are blocked. The sale is saved by the database function `process_sale` (`supabase/schema.sql`) in one transaction with row locks, so two counters can't sell the same stock.

## Run it

```bash
npm install
cp .env.example .env.local   # add your Supabase URL and key
npm run dev                  # http://localhost:3000
npm test                     # 46 unit tests
```

Database: run `supabase/schema.sql`, then `supabase/seed.sql`, in the Supabase SQL Editor. Full steps: **GUIDE.md**.

## Roles

| Role | Can do |
|---|---|
| Admin | Everything, including delete |
| Pharmacist | Add and edit medicines, suppliers and batches; sell |
| Sales Staff | Sell; view medicines and stock |
