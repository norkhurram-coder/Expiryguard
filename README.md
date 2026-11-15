# ExpiryGuard

**Smart Pharmacy Stock & Expiry Management System**
*Sell safe stock. Lose less to expiry.*
**Live demo:** https://expiryguard-lyart.vercel.app

Noor-ul-Haya · F24-BSSE-105 · Section 5B · Software Construction & Development · Instructor: Sir Waqas

Small medical stores in Pakistan track medicines in paper registers and check expiry dates by eye. ExpiryGuard records every medicine by batch and expiry date, sells the earliest-expiring batch first (FEFO), blocks expired stock at checkout, warns early (90/60/30 days), emails a daily summary, and forecasts which stock won't sell before it expires – using **multithreading** (worker threads) for the daily analysis.

## Tech stack

| Part | Tool |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Database & Auth | Supabase (PostgreSQL, Auth, Row Level Security) |
| Forms & validation | React Hook Form + Zod |
| Multithreading | Node.js `worker_threads` pool (server) + Web Workers (browser) |
| Scheduling & email | Vercel Cron + Nodemailer |
| Charts | Chart.js (react-chartjs-2) |
| Testing | Jest |
| Hosting | GitHub + Vercel |

## Progress

| Module | Status |
|---|---|
| Expiry logic + unit tests (`lib/expiry.ts`) | ✅ Done |
| Database schema, RLS, seed data | ✅ Done |
| Sign-up / login / logout with roles | ✅ Done |
| Layout + page protection | ✅ Done |
| Suppliers CRUD (FR-11 return window) | ✅ Done |
| Medicines CRUD (FR-01) | ✅ Done |
| Batches / purchase entry (FR-02, FR-03) | ✅ Done |
| Expiry dashboard, quarantine, low stock (FR-07, FR-13, FR-14) | ✅ Done |
| Role-based access (FR-16 basics) | ✅ Done |
| Sales with FEFO + expired-sale block + barcode (FR-04, FR-05, FR-06, NFR-05) | ✅ Done |
| Concurrency-safe checkout (row locks in `process_sale`) | ✅ Done |
| Risk forecast, FEFO-aware (FR-09, FR-10, FR-11, FR-12) | ✅ Done |
| Supplier returns + quarantine disposal | ✅ Done |
| Daily scan with worker threads + email alerts (FR-07, FR-08, NFR-04) | ✅ Done |
| Monthly reports with charts (FR-15) | ✅ Done |
| Admin-only roles, Users page (FR-16) | ✅ Done |
| Audit log of every stock change (NFR-06) | ✅ Done |
| Backup download (NFR-07) | ✅ Done |
| 34 unit tests incl. real multithreading tests | ✅ Done |

## Run it on your computer

```bash
npm install
cp .env.example .env.local   # then paste your Supabase URL and key into .env.local
npm run dev                  # open http://localhost:3000
npm test                     # runs all 34 tests (incl. the worker-thread tests)
```

Database: run `supabase/schema.sql`, then `supabase/seed.sql`, in the Supabase SQL Editor.

Optional settings for the daily scan and email (service key, cron secret, SMTP) are explained in `.env.example`.

Full step-by-step instructions: see **GUIDE.md**.

## Roles

The first account becomes **Admin**. Everyone else signs up as **Sales Staff** and the Admin assigns roles on the Users page.

| Role | Can do |
|---|---|
| Admin (Owner) | Everything, including delete, users & roles, audit log, backups, run scan |
| Pharmacist | Dashboard, stock, suppliers, forecast, alerts, reports, returns and disposal |
| Sales Staff | Sales screen and stock lookup only (FR-16) |

## Multithreading

| Where | How |
|---|---|
| Daily scan + Risk Forecast (server) | `lib/threads/pool.ts` starts a pool of Node.js **worker threads** (one per CPU core, max 4). The analysis is split into tasks – expiry scan, stock check, forecast parts – which run **in parallel**; results are merged on the main thread. |
| Dashboard (browser) | `components/BackgroundScan.tsx` starts two **Web Workers** that scan stock while the page stays responsive. |
| Checkout (database) | `process_sale` locks batch rows (`FOR UPDATE`), so two counters selling the last packs at the same moment can never oversell (no race condition). |

## Project structure

```
app/                 pages (dashboard, sales, medicines, batches, suppliers, forecast,
                     alerts, reports, users, audit) + api/cron and api/backup
components/ui/       reusable Button, Input, Card, Table, Badge, Alert…
components/…         forms and tables for each module
lib/expiry.ts        expiry, FEFO and forecast formulas (pure functions)
lib/analysis.ts      the daily analysis split into tasks for the threads
lib/threads/         worker-thread pool + the worker itself
lib/daily-scan.ts    daily scan: threads → email → scan history
lib/reports.ts       monthly report calculations
lib/validation.ts    all form validation rules (Zod)
lib/supabase/        Supabase clients for browser, server and proxy
proxy.ts             keeps users logged in and protects pages
supabase/            schema.sql (tables, RLS, functions) and seed.sql (sample data)
vercel.json          daily cron job (08:00 Pakistan time)
tests/               Jest unit tests
```
