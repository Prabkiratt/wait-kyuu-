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

---

## Contents
- [Quick start](#quick-start)
- [What's in the box](#whats-in-the-box)
- [Try the core demo](#try-the-core-demo-2-minutes)
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
cp .env.example .env.local   # optional: add Google keys, change the admin password
npm run dev                  # http://localhost:3000
```

On first start the app seeds itself: 11 businesses across 10 categories, live queues, reviews and 14 days of
history. Data persists to `.data/db.json` (git-ignored). Admin → Settings → **Reset to demo data** restores the seed.

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

### Demo accounts (local development only)
- **Merchants:** `/merchant/login` has one-click demo sign-in for every seeded business. Every seeded owner is
  `owner@<slug>.test`; the shared demo password is `DEMO_PASSWORD` in [`src/lib/seed.ts`](src/lib/seed.ts).
- **Customer:** `/login` has a one-click demo customer.
- **Admin:** `/admin`, email + `ADMIN_EMAIL` / `ADMIN_PASSWORD` (dev defaults are in [`.env.example`](.env.example)),
  or Google via `ADMIN_EMAILS`.

One-click demo sign-in is disabled in production unless `DEMO_MODE=1`.

## Configuration

Copy [`.env.example`](.env.example) to `.env.local`.

| Variable | Purpose | Default |
|---|---|---|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Platform admin email + password sign-in. **Change before deploying.** | `admin@vouchiq.test` / `admin1234` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enables "Continue with Google". | unset (button explains how to enable) |
| `ADMIN_EMAILS` | Comma-separated Google emails promoted to admin on sign-in. | none |
| `APP_URL` | Public base URL (behind a proxy / in production); must match the OAuth redirect host. | request origin |
| `DEMO_MODE=1` | Allow one-click demo sign-in outside development. | off |
| `REQUIRE_APPROVAL=1` | New businesses need admin approval (also a toggle in Admin → Settings). | off |

## Google sign-in

Implemented as the OAuth 2.0 authorization-code flow (`/api/auth/google` → `/api/auth/google/callback`) with a
signed state cookie and a verified-email check. It needs credentials only you can create:

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID** → *Web application*.
2. Add the authorised redirect URI `http://localhost:3000/api/auth/google/callback` (and your production URL).
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`, then restart.
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

**Real-time = Server-Sent Events.** Each screen opens an `EventSource`; the server recomputes that screen's view on
every queue change and pushes it only when it actually changed. SSE is one-directional (all this product needs),
survives proxies, reconnects by itself and needs no extra service.

**Storage: local store behind the domain model.** State lives in memory with JSON persistence
([`src/lib/store.ts`](src/lib/store.ts)). All queue and market logic is in [`src/lib/engine.ts`](src/lib/engine.ts)
and [`src/lib/market.ts`](src/lib/market.ts). [`supabase/schema.sql`](supabase/schema.sql) is the production target
(PostGIS, row-level security, hashed ticket tokens, `join_queue` / `my_ticket` / `next_customer` RPCs, Realtime
broadcast trigger). **That schema has not been applied or tested**, and the JSON store is single-process.

**Wait time** is *people ahead × average service minutes*. `estimateServiceMin` in `engine.ts` is the single hook for
historical or ML estimates. A business with no live queue shows **"Live queue unavailable"** and never a made-up number.

**Ranking is transparent.** "Relevance" is only a text-match score with weights editable in Admin → Settings. No paid
placement, no hidden boosts, and the UI says so.

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Leaflet + OpenStreetMap,
`qrcode`. Photography from Unsplash (hot-linked, attributed in the footer).

## Project structure

```
src/
  app/
    page.tsx, search/, business/[slug]/, join/[slug]/, t/[token]/   public marketplace + customer queue
    account/, login/, merchant/{login,onboarding}/                  accounts, merchant entry
    admin/[section]/                                                admin console
    api/                                                            route handlers (auth, market, queue, admin, qr)
  components/    UI (+ admin/ console kit)
  lib/
    engine.ts    queue engine: join / next / skip / remove, wait estimate, views
    market.ts    search, filters, transparent ranking
    store.ts     data store + persistence + change bus
    server.ts    sessions, authorization helpers, rate limiting, SSE helper
    seed.ts      demo dataset (real photography)
supabase/schema.sql   production Postgres schema with RLS
```

## Security

- Passwords hashed with scrypt + per-user salt; sessions are HMAC-signed, `httpOnly`, `SameSite=Lax` cookies.
- Every merchant action resolves its target through ownership checks (`ownedQueue` / `ownedTicket` / `ownedBusiness`);
  another business's resources return 404. Admin routes require the `admin` role server-side.
- Customers hold an unguessable 144-bit ticket token. Their stream exposes only their own position: no phone numbers,
  no other customers. Phone numbers are visible only to the owning business and admins.
- Input validation on every route, markup characters stripped, in-memory rate limits on join / auth / actions,
  same-site-only post-login redirects, CSV export protected against formula injection.
- Suspended users lose access immediately; admin actions are audit-logged.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |

## Known limitations & roadmap

- **Persistence:** swap the JSON store for Supabase/Postgres (schema provided) before any multi-instance deploy.
- **Rate limiting** is per-process and trusts `x-forwarded-for`; use an edge or Redis limiter behind a real proxy.
- **Not built yet:** WhatsApp / SMS / push notifications, appointment booking, payments, subscriptions, AI wait
  prediction, image upload (cover photos are URLs), per-day opening hours editor, multi-branch UI (schema supports it).
- **Tests:** verified by manual and scripted end-to-end runs; there is no automated test suite yet.
- **License:** none specified yet. All rights reserved by default until one is added.
