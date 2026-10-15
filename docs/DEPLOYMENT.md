# Deploying Wait? Kyu?

Three pieces, each on the platform that suits it:

```
 Browser ──► Vercel (Next.js frontend)                       Supabase (PostgreSQL)
              │   /api/*  ── rewrite ──►  Render (Node API) ──────────►  tables + RLS
              │                              ▲
              └── live streams (SSE) ────────┘   (browser connects straight to the API host)
```

| Piece | Platform | What runs there |
|---|---|---|
| Frontend | **Vercel** | The Next.js app (`src/`). Renders pages, proxies `/api/*` to the API. Holds **no** data and **no** secrets. |
| API | **Render** | The Node server (`server/`): auth, queue engine, search, admin, live streams. |
| Database | **Supabase** | PostgreSQL. Only the API connects to it. |

Do the steps **in this order**; each needs a value from the previous one.

---

## 1. Supabase (database)

1. Create a project at <https://supabase.com/dashboard>. Pick the region closest to your Render region
   (Singapore for India). Save the **database password** you set.
2. Open **Project Settings → Database → Connection string** and copy the **Session pooler** string:

   ```
   postgresql://postgres.<project-ref>:<YOUR-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

   > Use the *Session pooler*, not "Direct connection". Direct connections are IPv6-only on Supabase and Render
   > connects over IPv4. (The *Transaction pooler* on port 6543 also works for this app.)
3. **Nothing else to do.** The API creates all tables on first boot from
   [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql). If you prefer, paste that file into
   **SQL Editor → New query → Run** yourself; it is idempotent.

Row Level Security is enabled on every table with no policies, so Supabase's public REST API (anon key) can read
and write **nothing**. Only the API's direct connection can. You do not need the Supabase anon/service keys.

## 2. Render (API)

1. <https://dashboard.render.com> → **New → Blueprint** → pick this GitHub repo. Render reads
   [`render.yaml`](../render.yaml). (Or **New → Web Service** and enter the same settings by hand.)
2. Fill in the environment variables it asks for:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | The Supabase session-pooler string from step 1 |
   | `FRONTEND_URL` | Leave a placeholder for now, e.g. `https://wait-kyu.vercel.app`. Fixed in step 4. |
   | `ADMIN_EMAIL` | Your admin login email |
   | `ADMIN_PASSWORD` | A strong password (**not** the dev default) |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From step 5 (can be added later) |
   | `ADMIN_EMAILS` | Optional: Google accounts that become admins |

3. Deploy. Watch the logs for:

   ```
   [store] empty postgres store: seeding base catalogue only
   [api] listening on :10000
   ```

4. Open `https://<your-service>.onrender.com/healthz`. You should see `{"ok":true,"store":"postgres"}`.
   **Copy the service URL.**

**Keep it at one instance.** The API holds a live in-memory copy of the data (that is how it pushes instant updates)
and writes every change through to Supabase. Two instances would show different queues. `numInstances: 1` is set
in the blueprint.

**Free vs paid.** Render's free plan sleeps after ~15 minutes idle; the next visitor waits 30–60 s for a cold start.
Fine for a demo, not for real customers. Use the **Starter** plan (the blueprint default) for production.

**Demo data.** A production database starts with only the category catalogue and *no* businesses or users: the
demo accounts share a well-known password and must never be public. To start with the demo businesses anyway, set
`SEED_DEMO=1` before the first boot (and `DEMO_MODE=1` for one-click demo sign-in).

## 3. Vercel (frontend)

1. <https://vercel.com/new> → import the repo. Framework preset **Next.js**, root directory `./`, defaults for
   build settings.
2. Add environment variables (all environments):

   | Variable | Value |
   |---|---|
   | `API_URL` | The Render URL, e.g. `https://wait-kyu-api.onrender.com` |
   | `NEXT_PUBLIC_API_URL` | The same URL |

   > Both are read at **build** time (`API_URL` configures the `/api/*` rewrite; `NEXT_PUBLIC_*` is inlined into
   > the browser bundle). If you change them, **redeploy**.
3. Deploy. Copy your production URL (e.g. `https://wait-kyu.vercel.app`, or your custom domain).

## 4. Point the API at the frontend

Back in Render, set **`FRONTEND_URL`** to your real Vercel URL (no trailing slash; comma-separate if you have
several, e.g. a custom domain plus the `*.vercel.app` one) and let it redeploy. It is used for:

- **CORS** on the live streams (the browser connects to Render directly),
- the **Google OAuth callback** and post-login redirects,
- the **QR codes** (`<FRONTEND_URL>/join/<slug>`).

## 5. Google sign-in (optional but recommended)

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
2. **Authorised redirect URI:** `https://<your-vercel-domain>/api/auth/google/callback` (the *frontend* domain, not Render).
3. Put the Client ID / Secret into Render's `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; redeploy.
4. For testing locally also add `http://localhost:3000/api/auth/google/callback`.

## 6. Verify

| Check | Expected |
|---|---|
| `https://<render>/healthz` | `{"ok":true,"store":"postgres"}` |
| `https://<vercel>/` | Home page renders (categories from the API) |
| Sign in at `/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin console opens |
| Admin → Settings | Shows the Google status as *Configured* |
| Create a business via `/merchant/onboarding`, then join its queue from another browser, press **NEXT** | The customer's ticket updates live |
| Supabase → Table Editor | Rows in `businesses`, `tickets`, … |
| Restart the Render service | Data and logins survive (the secret and all data are in Postgres) |

## Local development

```bash
cp .env.example .env.local          # frontend: API_URL / NEXT_PUBLIC_API_URL -> http://localhost:4000
cp server/.env.example server/.env  # API: leave DATABASE_URL empty to use a local JSON file
npm install
npm run dev:all                     # Next on :3000 and the API on :4000
```

To develop against a real database, put a Supabase (or any Postgres) URL in `server/.env`.

## Operations notes

- **Backups & restore:** Supabase takes daily backups on paid plans; you can also `pg_dump` the pooler string.
- **Rotating the session secret** signs everyone out: `delete from app_meta where key = 'secret';` then restart the API.
- **Logs:** Render → service → Logs. The API logs `[store] persist failed:` if a database write fails (it retries).
- **Scaling beyond one instance** needs cross-instance change fan-out (Postgres `LISTEN/NOTIFY` or Supabase
  Realtime) and moving per-process rate limits to Redis. Not needed for a single-city launch.
- **Cold starts:** when the API is asleep, server-rendered pages fall back to defaults after 6 s rather than
  hanging, and client-side data fills in once it wakes. A paid plan removes this.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Pages load but data is empty / "Something went wrong" | `API_URL` wrong or the API is asleep/crashed. Check `/healthz`. Redeploy Vercel after changing it. |
| Signed in, then immediately signed out | Requests are not going through the rewrite: `API_URL` missing at build time. Cookies must be set on the Vercel domain. |
| Live badge says "RECONNECTING…" forever | `NEXT_PUBLIC_API_URL` wrong, or `FRONTEND_URL` on Render doesn't match your site's exact origin (CORS). |
| Google: `redirect_uri_mismatch` | The URI in Google Cloud must be `https://<vercel-domain>/api/auth/google/callback` exactly. |
| API fails with `ENETUNREACH` / `ECONNREFUSED` to the DB | You used the *Direct connection* string (IPv6). Use the Session pooler. |
| `password authentication failed` | The password in `DATABASE_URL` is wrong (URL-encode special characters). |
| QR codes point at the wrong site | `FRONTEND_URL` unset on Render. |
