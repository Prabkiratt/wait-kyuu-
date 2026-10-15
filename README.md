# Wait? Kyu?

**Never wait blindly again.** A real-time queue and waiting-time marketplace: customers discover nearby
businesses, compare **live** wait times, join a queue without an account, and track their position from
anywhere. Businesses run their line from a one-tap dashboard and a printable QR code.

> *Kyu* is Hindi for "why": **Wait? Why?** The logo is a queue ticket with a question mark.

It is deliberately **not** a salon app. The model is generic:

```
Business → Category → Services → Queues → Tickets
```

A salon, a dental clinic, a car-service garage or a cafe are all just data. Adding "City Dental" never needs a code
change, only onboarding or the admin console.

```
 Browser ──► Vercel · Next.js frontend                         Supabase · PostgreSQL
              │  /api/*  ── rewrite ──►  Render · Node API ──────────►  tables + RLS
              │                             ▲
              └── live streams (SSE) ───────┘
```

---

## Contents
- [Quick start](#quick-start)
- [What's in the box](#whats-in-the-box)
- [Try the core demo](#try-the-core-demo-2-minutes)
- [Deploying](#deploying-vercel--render--supabase)
- [Configuration](#configuration)
- [Google sign-in](#google-sign-in)
- [Admin console](#admin-console)
- [Architecture & decisions](#architecture--decisions)
- [Project structure](#project-structure)
- [Security](#security)
- [Scripts](#scripts)
- [Known limitations & roadmap](#known-limitations--roadmap)

## Quick start

Requires **Node.js 20+**.

```bash
git clone https://github.com/Prabkiratt/wait-kyuu-.git
cd wait-kyuu-
npm install
cp .env.example .env.local           # frontend -> points at the API on :4000
cp server/.env.example server/.env   # API (leave DATABASE_URL empty: local JSON file)
npm run dev:all                      # frontend :3000  +  API :4000
```

Open <http://localhost:3000>. On first start the API seeds itself: 11 businesses across 10 categories, live queues,
reviews and 14 days of history. Locally it persists to `.data/db.json` (git-ignored); with `DATABASE_URL` set it
uses Postgres instead. Admin → Settings → **Reset to demo data** restores the seed.

Run the pieces separately with `npm run dev` (frontend) and `npm run dev:api` (API).

> The dev server compiles on demand, so the very first request after a cold start can take a minute.

## What's in the box

| Area | What it does |
|---|---|
| **Marketplace** | Search by name, category, service or area ("haircut near indiranagar"). Filters: category, open now, live queue, max wait, rating. Sort: relevance, shortest wait, distance, rating. List and map views. Live: results re-order as queues move. |
| **Business page** | Photo gallery, live queue (now serving, people waiting, estimated wait), services and prices, hours, reviews, call / share / directions. |
| **Customer queue** | Join in seconds with a name: no app, no account. A private ticket page shows your number, people ahead and wait, updates by itself and tells you when you're next. |
| **Customer accounts** | Optional. Sign in with Google or email to keep favourites and ticket history across devices. |
| **Merchant dashboard** | One big **NEXT CUSTOMER** button, skip / remove / add walk-in, pause queue, multiple queues per business, QR code (download / print / display), analytics (peak hours, 14-day trend, avg wait / service time, abandonment), profile and services. |
| **Onboarding** | Account → business details → services → queue → QR → live on the marketplace. |
| **Admin console** | Overview with live KPIs and charts; manage businesses, queues, tickets, users, reviews, categories and platform settings; audit log; CSV exports. |
| **Live everything** | Marketplace, business page, ticket and dashboard all update in real time over Server-Sent Events. No refresh. |

## Try the core demo (2 minutes)

1. Open `/` and search **salon**. Three salons appear with live waits (e.g. 5 / 12 / 25 min).
2. Open one, press **Join queue**, enter a name. You get a ticket such as `H9`, with *people ahead* and *est. wait*.
3. In a second tab, go to `/merchant/login`, pick the same business under **Demo mode**, press **NEXT CUSTOMER**.
4. Watch the customer's ticket update on its own: ahead 2 → 1 → **"You're next!"** → **"It's your turn!"**.

### Demo accounts (development, or `DEMO_MODE=1`)
- **Merchants:** `/merchant/login` has one-click demo sign-in for every seeded business. Every seeded owner is
  `owner@<slug>.test`; the shared demo password is `DEMO_PASSWORD` in [`server/src/lib/seed.ts`](server/src/lib/seed.ts).
- **Customer:** `/login` has a one-click demo customer.
- **Admin:** `/admin`, email + `ADMIN_EMAIL` / `ADMIN_PASSWORD` (dev defaults in [`server/.env.example`](server/.env.example)),
  or Google via `ADMIN_EMAILS`.

In production the first boot seeds **only the category catalogue**: no demo accounts exist unless you set `SEED_DEMO=1`.

## Deploying: Vercel + Render + Supabase

| Piece | Platform | Config |
|---|---|---|
| Frontend (`src/`) | **Vercel** | env: `API_URL`, `NEXT_PUBLIC_API_URL` → the Render URL |
| API (`server/`) | **Render** | [`render.yaml`](render.yaml) blueprint; env: `DATABASE_URL`, `FRONTEND_URL`, admin + Google keys |
| Database | **Supabase** | Postgres; tables are created on first boot from [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) |

**Full step-by-step guide, verification checklist and troubleshooting: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).**

## Configuration

Two env files, one per deployable. Templates: [`.env.example`](.env.example) (frontend) and
[`server/.env.example`](server/.env.example) (API).

### Frontend (Vercel) — `.env.local`
| Variable | Purpose |
|---|---|
| `API_URL` | API origin. Server-side: used for the `/api/*` rewrite and server rendering. **Build-time on Vercel.** |
| `NEXT_PUBLIC_API_URL` | Same URL, exposed to the browser so live streams connect straight to the API. |

### API (Render) — `server/.env`
| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (session pooler). Empty → local JSON file. | empty |
| `FRONTEND_URL` | Website origin(s), comma-separated. CORS for streams, OAuth callback, QR codes. | `http://localhost:3000` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Platform admin email + password sign-in. **Change before deploying.** | `admin@vouchiq.test` / `admin1234` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enables "Continue with Google". | unset |
| `ADMIN_EMAILS` | Google emails promoted to admin on sign-in. | none |
| `SEED_DEMO=1` | Production first boot seeds demo businesses (accounts share a known password!). | off |
| `DEMO_MODE=1` | One-click demo sign-in and "Reset to demo data" outside development. | off |
| `PORT` | HTTP port (Render sets it). | `4000` |

## Google sign-in

Implemented as the OAuth 2.0 authorization-code flow (`/api/auth/google` → `/api/auth/google/callback`) with a
signed state cookie and a verified-email check. It needs credentials only you can create:

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID** → *Web application*.
2. Authorised redirect URI: `<FRONTEND_URL>/api/auth/google/callback` — the **frontend** domain, e.g.
   `http://localhost:3000/api/auth/google/callback` locally and `https://<your-app>.vercel.app/api/auth/google/callback`
   in production. (The request reaches the API through the Vercel rewrite, so the session cookie lands on your domain.)
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the API, then restart.
4. Optional: `ADMIN_EMAILS=you@gmail.com` makes that Google account a platform admin.

Customers sign in at `/login`, merchants at `/merchant/login`, admins at `/admin`. Without the keys, email and
password still work. *The live Google round-trip has not been exercised in this repo (no credentials were available).*

## Admin console

`/admin`: Overview · Businesses · Live queues · Tickets · Users · Reviews · Categories · Settings · Audit log.

- **Businesses:** edit every field, photos, services and queues; approve, suspend or delete.
- **Live queues:** operate any queue on the platform (next / skip / remove / add / pause / clear).
- **Users:** change role, suspend (kills their session immediately), set a password, delete.
- **Categories:** database-driven, with photos and search keywords. No code change to add one.
- **Settings:** branding, site-wide announcement banner, sign-up and approval switches, "busy" wait thresholds,
  search-ranking weights.
- **Audit log:** every admin change, with actor and time. CSV export for businesses, users and tickets.
- **Safeguards:** you can't suspend, demote or delete yourself or the last admin.

## Architecture & decisions

**Three deployables.** The Next.js frontend holds no data and no secrets. All `/api/*` calls are proxied by a Next
rewrite to the API, so the browser only ever talks to one origin for requests (first-party cookies, no CORS, the
Google callback lands on the site's own domain). The live streams connect straight to the API host, because proxies
are a poor fit for long-lived connections; the merchant stream authenticates with a short-lived signed token
(`POST /api/merchant/stream-token`) since `EventSource` can't send cookies cross-site.

**Real-time = Server-Sent Events.** Each screen opens an `EventSource`; the API recomputes that screen's view on
every queue change and pushes it only when it actually changed. SSE is one-directional (all this product needs),
survives proxies, reconnects by itself and needs no extra service.

**Data: in-memory working set, written through to Postgres.** The API loads the dataset from Supabase at boot,
serves reads and runs the queue logic against memory (so a NEXT click is instant and transactionally simple), and
writes only the rows that changed back to Postgres within ~150 ms ([`server/src/persist/pg.ts`](server/src/persist/pg.ts)).
Tables have real columns, constraints and indexes; RLS is on with no policies so the Supabase public API sees
nothing. The trade-off: **one API instance** (see limitations).

**Wait time** is *people ahead × average service minutes*. `estimateServiceMin` in `server/src/lib/engine.ts` is the
single hook for historical or ML estimates. A business with no live queue shows **"Live queue unavailable"** and
never a made-up number.

**Ranking is transparent.** "Relevance" is only a text-match score with weights editable in Admin → Settings. No paid
placement, no hidden boosts, and the UI says so.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Hono on Node (API), `pg`, PostgreSQL,
Leaflet + OpenStreetMap, `qrcode`. Photography from Unsplash (hot-linked, attributed in the footer).

## Project structure

```
src/                         FRONTEND (deploys to Vercel)
  app/                       pages: marketplace, business, ticket, account, login, merchant, admin
  components/                UI (+ admin/ console kit)
  lib/
    client.ts                browser helpers: live streams, auth-token hook, favourites
    api-server.ts            server-side fetches to the API (with timeouts + fallbacks)
    types.ts, photo.ts       shared types / image helper
server/                      API (deploys to Render)
  src/
    index.ts, app.ts         boot + HTTP routing (Hono), CORS, health check
    routes/                  one file per endpoint group
    lib/
      engine.ts              queue engine: join / next / skip / remove, wait estimate, views
      market.ts              search, filters, transparent ranking
      store.ts               in-memory dataset, write-through scheduling, change bus
      server.ts              sessions, stream tokens, authorization, rate limiting, SSE helper
      seed.ts                demo dataset (real photography) + base catalogue
    persist/                 pg.ts (Supabase/Postgres), file.ts (local dev)
  test/persist.test.ts       persistence tests against real Postgres (PGlite)
supabase/migrations/         0001_init.sql: tables, constraints, RLS
render.yaml                  Render blueprint
docs/DEPLOYMENT.md           deployment guide
```

## Security

- Passwords hashed with scrypt + per-user salt; sessions are HMAC-signed, `httpOnly`, `SameSite=Lax`, `Secure` in
  production. The signing secret is stored in Postgres, so sessions survive restarts.
- Every merchant action resolves its target through ownership checks (`ownedQueue` / `ownedTicket` / `ownedBusiness`);
  another business's resources return 404. Admin routes require the `admin` role on the server, and the admin UI is
  gated server-side before anything renders.
- Customers hold an unguessable 144-bit ticket token. Their stream exposes only their own position: no phone numbers,
  no other customers. Phone numbers are visible only to the owning business and admins.
- CORS allow-list (`FRONTEND_URL`) on the direct stream host; merchant streams need a 15-minute signed token.
- Input validation on every route, markup characters stripped, in-memory rate limits on join / auth / actions,
  same-site-only post-login redirects, CSV export protected against formula injection.
- Database: RLS enabled on every table with no policies; only the API's direct connection can read or write.
- Suspended users lose access immediately; admin actions are audit-logged.
- A public deployment never contains the demo accounts (shared password) unless you opt in with `SEED_DEMO=1`.

## Scripts

| Command | |
|---|---|
| `npm run dev:all` | Frontend (:3000) + API (:4000) with hot reload |
| `npm run dev` / `npm run dev:api` | Frontend only / API only |
| `npm run build` / `npm start` | Build / serve the frontend |
| `npm run start:api` | Run the API (what Render runs) |
| `npm run test:api` | Persistence tests against an in-process Postgres |
| `npm run typecheck` | Type-check frontend and API |
| `npm run lint` | ESLint |

## Known limitations & roadmap

- **Single API instance.** The in-memory working set and the per-process rate limiter assume one instance. Scaling out
  needs change fan-out (Postgres `LISTEN/NOTIFY` or Supabase Realtime) and a shared limiter (Redis). One instance
  comfortably serves a city-scale launch.
- **Cold starts** on Render's free plan (30–60 s). Server-rendered pages fall back to defaults after 6 s; use a paid plan.
- **Not built yet:** WhatsApp / SMS / push notifications, appointment booking, payments, subscriptions, AI wait
  prediction, image upload (cover photos are URLs), per-day opening hours editor, multi-branch UI.
- **Tests:** persistence layer is covered by automated tests; the rest was verified by manual and scripted
  end-to-end runs. There is no browser-level automated suite yet.
- **Not exercised here:** the live Google OAuth round-trip and a deployment to real Vercel / Render / Supabase
  accounts (no credentials). The Postgres path was verified against PGlite, a real PostgreSQL engine.
- **License:** none specified yet. All rights reserved by default until one is added.
