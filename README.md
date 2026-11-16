# ExpiryGuard

**Smart Pharmacy Stock & Expiry Management System**
*Sell safe stock. Lose less to expiry.*
**Live demo:** https://expiryguard-lyart.vercel.app

Noor-ul-Haya · F24-BSSE-105 · Section 5B · Software Construction & Development · Instructor: Sir Waqas

Small medical stores in Pakistan track medicines in paper registers and check expiry dates by eye. ExpiryGuard records every medicine by batch and expiry date, blocks expired stock, warns early (90/60/30 days), and – in the next milestones – sells the earliest-expiring batch first (FEFO) and forecasts which stock won't sell before it expires.

## Tech stack

| Part | Tool |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Database & Auth | Supabase (PostgreSQL, Auth, Row Level Security) |
| Forms & validation | React Hook Form + Zod |
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
| Sales with FEFO (FR-04, FR-05, FR-06) | ⬜ Next |
| Risk forecast (FR-09, FR-10, FR-12) | ⬜ Next |
| Daily email alerts (FR-08) | ⬜ Next |
| Monthly reports (FR-15) | ⬜ Next |

## Run it on your computer

```bash
npm install
cp .env.example .env.local   # then paste your Supabase URL and key into .env.local
npm run dev                  # open http://localhost:3000
npm test                     # runs the expiry logic tests
```

Database: run `supabase/schema.sql`, then `supabase/seed.sql`, in the Supabase SQL Editor.

Full step-by-step instructions (Mac): see **GUIDE.md**.

## Roles

| Role | Can do |
|---|---|
| Admin (Owner) | Everything, including delete |
| Pharmacist | View, add and edit medicines, suppliers and batches |
| Sales Staff | View medicines and stock only |

## Project structure

```
app/                 pages (login, signup, dashboard, medicines, batches, suppliers)
components/ui/       reusable Button, Input, Card, Table, Badge, Alert…
components/…         forms and tables for each module
lib/expiry.ts        expiry, FEFO and forecast formulas (pure functions)
lib/validation.ts    all form validation rules (Zod)
lib/supabase/        Supabase clients for browser, server and proxy
proxy.ts             keeps users logged in and protects pages
supabase/            schema.sql (tables, RLS) and seed.sql (sample data)
tests/               Jest unit tests
```
