# All Star Dashboard

Internal dashboard for All Star Turlock. Three views:

1. **Reorder Calls** — last year's Printavo orders whose anniversary is 21–45
   days out, filtered to orders that were $200+, from recurring customers, or
   tagged as events in the job name.
2. **Weekly Leads** — a fresh list of prospects to call each Monday, pulled
   from Google Places (schools, gyms, leagues) plus local school-district
   directories within 25 miles of Turlock, CA.
3. **Competition** — track competitor pricing, products, promos, and social
   posts. Configurable scrape targets per competitor; daily cron refresh.

## Tech stack

- Next.js 16 (App Router, Turbopack) + React 19
- TypeScript + Tailwind v4
- Supabase Postgres via the `postgres` (postgres-js) driver
- Deploys to Vercel; Vercel Cron drives the sync jobs.

## One-time setup

1. **Install deps**
   ```bash
   npm install
   ```

2. **Provision a database.** Create a Supabase project at
   https://supabase.com/dashboard, then grab Project Settings → Database →
   Connection string → **Transaction pooler** (port 6543). Save it as
   `DATABASE_URL` in `.env.local` (see `.env.example`). The driver is
   configured with `prepare: false`, which the transaction pooler requires.

3. **Apply the schema**
   ```bash
   npm run db:push
   ```

4. **Fill in the rest of `.env.local`:**
   - `DASHBOARD_PASSWORD` — the shared password you'll type at the login screen.
   - `SESSION_SECRET` — any long random string (session cookie HMAC).
   - `CRON_SECRET` — Vercel will send this as a Bearer token to /api/cron/*.
   - `PRINTAVO_EMAIL` / `PRINTAVO_TOKEN` — from Printavo → My Account → API.
   - `GOOGLE_PLACES_API_KEY` — Google Cloud Console, enable “Places API (New)”.

5. **Run locally**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000 and sign in with `DASHBOARD_PASSWORD`.

6. **First-time data load.** After signing in, click:
   - *Sync Printavo now* on the Reorders page — pulls ~13 months of invoices.
   - *Sync leads now* on the Leads page — populates Google Places + schools.
   - Add a competitor on the Competition page, configure scrape targets, and
     click *Scrape now*.

## Deploy to Vercel

1. Push this repo / subtree to GitHub (see “Extract to its own repo” below).
2. Import in Vercel. Set all env vars from `.env.example` under
   Project → Settings → Environment Variables.
3. Vercel auto-detects `vercel.json` and registers three cron jobs:
   - `/api/cron/printavo-sync` — daily 08:00 UTC
   - `/api/cron/leads-sync` — Mondays 09:00 UTC
   - `/api/cron/competitors-sync` — daily 06:00 UTC
4. Once deployed, run the schema push against the production DB by running
   `npm run db:push` locally with `DATABASE_URL` pointed at prod.

## Swapping in Microsoft SSO later

The proxy at `src/proxy.ts` only checks that `getSession()` returns a valid
session. To switch to Microsoft:

1. Install a provider like `next-auth` with the Azure AD provider.
2. Replace `src/app/login/page.tsx` and `src/app/api/auth/*` with
   `next-auth`'s routes.
3. Keep `getSession()` shape-compatible (`{ sub, exp }`) — the rest of the app
   doesn't need to change.

## Extract to its own repo

This app currently lives in the `dashboard/` subdirectory of
`caghassi/all-star-inventory-app`. To publish it as its own repo:

```bash
# from the monorepo root
git subtree split --prefix=dashboard -b allstar-dashboard-split
cd /tmp && git clone /path/to/all-star-inventory-app allstar-dashboard
cd allstar-dashboard
git checkout allstar-dashboard-split
git remote remove origin
git remote add origin git@github.com:caghassi/allstar-dashboard.git
git push -u origin main
```

## Project layout

```
dashboard/
  src/
    proxy.ts                  # Next.js 16 middleware (session gate)
    app/
      api/
        auth/{login,logout}/  # Password login + logout
        cron/                 # Sync jobs - authed by CRON_SECRET
          printavo-sync/
          leads-sync/
          competitors-sync/
      login/                  # /login page
      reorders/               # Reorder call list
      leads/                  # Weekly call list
      competitors/            # Competition tracking
    components/Shell.tsx
    lib/
      auth.ts                 # Session cookie + password check
      db.ts                   # postgres-js tagged template (Supabase)
      config.ts               # Geo, keywords, thresholds
      printavo.ts             # Printavo GraphQL client
      reorder-sync.ts         # Pulls invoices + rebuilds reorder queue
      places.ts               # Google Places (New) client
      schools.ts              # Local school-district scraper
      leads-sync.ts           # Upserts leads + rotates weekly queue
      competitor-sync.ts      # Per-competitor scrape runner
      cron-auth.ts            # Bearer-token / session check
    db/schema.sql             # Postgres DDL
  scripts/db-push.mjs         # Applies schema.sql to $DATABASE_URL
  vercel.json                 # Cron schedule
```

## How the reorder rule works

A Printavo invoice qualifies for the reorder queue if ALL of these are true:

- Its `due_date` + 365 days falls within `[today+21, today+45]` days.
- AT LEAST ONE of:
  - `order_total_cents >= 20000` ($200)
  - The customer has 2+ historical orders (recurring)
  - The job name contains an event keyword: `tournament`, `tourney`,
    `camp`, `league`, `season`, `classic`, `invitational`, `championship`,
    `showcase`, `meet`, `relay`

Tune the constants in `src/lib/config.ts`.

## Notes on the Printavo API

- Authentication uses `email` + `token` HTTP headers.
- The `invoices` connection supports cursor pagination via `first` / `after`.
- We pull 13 months on every sync to stay fully caught up without relying on
  webhooks. A single sync costs roughly N/50 GraphQL calls where N is your
  yearly invoice count.

## Notes on Google Places

- Uses the *new* Places API (`places.googleapis.com/v1`), not the legacy one.
- Field masks keep billing minimal — we only request fields we store.
- Each Text Search call is billed per response page. The weekly sync makes
  roughly `PLACES_TYPES.length + PLACES_KEYWORDS.length` searches, each up to
  3 pages of 20 results.
