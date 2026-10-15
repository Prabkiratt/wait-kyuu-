-- Wait? Kyu? — initial schema (PostgreSQL / Supabase).
--
-- The API server (Render) is the only client of this database: it connects with a direct Postgres
-- connection string and keeps a working copy in memory, writing changes through to these tables.
-- It is idempotent, so the server also runs it on boot; you can paste it into the Supabase SQL editor too.
--
-- Security: RLS is enabled on every table with NO policies. The Supabase REST/anon API therefore
-- cannot read or write anything here; only the server's direct connection (which bypasses RLS) can.

create table if not exists users (
  ord bigint generated always as identity,
  id text primary key,
  email text not null unique,
  pass_hash text,                              -- null for Google-only accounts
  role text not null check (role in ('customer','merchant','admin')),
  created_at bigint not null,
  name text,
  picture text,
  google_id text unique,
  status text not null default 'active' check (status in ('active','suspended')),
  favorites jsonb not null default '[]',
  last_login_at bigint
);

create table if not exists categories (
  ord bigint generated always as identity,
  id text primary key,
  slug text not null unique,
  name text not null,
  icon text not null default '',
  keywords jsonb not null default '[]',
  image_url text
);

create table if not exists businesses (
  ord bigint generated always as identity,
  id text primary key,
  slug text not null unique,
  owner_id text not null references users(id) deferrable initially deferred,
  category_id text not null references categories(id) deferrable initially deferred,
  name text not null,
  description text not null default '',
  phone text not null default '',
  address text not null default '',
  area text not null default '',
  city text not null default '',
  lat double precision not null,
  lng double precision not null,
  image_url text,
  gallery jsonb not null default '[]',
  hue integer not null default 0,
  hours jsonb not null,                        -- {open, close, tzOffsetMin}
  live_queue boolean not null default true,    -- false => "Live queue unavailable"
  approval text not null default 'approved' check (approval in ('pending','approved','suspended')),
  created_at bigint not null
);
create index if not exists businesses_owner_idx on businesses(owner_id);
create index if not exists businesses_category_idx on businesses(category_id);

create table if not exists services (
  ord bigint generated always as identity,
  id text primary key,
  business_id text not null references businesses(id) on delete cascade deferrable initially deferred,
  name text not null,
  duration_min integer not null check (duration_min between 1 and 600),
  price double precision
);
create index if not exists services_business_idx on services(business_id);

create table if not exists queues (
  ord bigint generated always as identity,
  id text primary key,
  business_id text not null references businesses(id) on delete cascade deferrable initially deferred,
  name text not null,
  service_id text,
  status text not null default 'open' check (status in ('open','paused')),
  prefix text not null,
  next_seq bigint not null default 1,          -- strict ordering
  counter integer,                             -- display number, restarts daily
  counter_day text,
  avg_service_min integer not null default 10, -- MVP wait estimator input
  max_size integer,
  created_at bigint not null
);
create index if not exists queues_business_idx on queues(business_id);

create table if not exists tickets (
  ord bigint generated always as identity,
  id text primary key,
  queue_id text not null references queues(id) on delete cascade deferrable initially deferred,
  business_id text not null references businesses(id) on delete cascade deferrable initially deferred,
  token text not null unique,                  -- the customer's private credential
  number text not null,
  seq bigint not null,
  name text not null,
  phone text,                                  -- never exposed to customers or the public
  user_id text,
  status text not null check (status in ('WAITING','CALLED','SERVING','COMPLETED','SKIPPED','CANCELLED')),
  source text not null default 'online' check (source in ('online','walk-in')),
  joined_at bigint not null,
  called_at bigint,
  served_at bigint,
  completed_at bigint
);
create index if not exists tickets_queue_status_idx on tickets(queue_id, status, seq);
create index if not exists tickets_business_idx on tickets(business_id, joined_at);
create index if not exists tickets_user_idx on tickets(user_id) where user_id is not null;

create table if not exists queue_events (      -- audit trail; feeds analytics and future wait prediction
  ord bigint generated always as identity,
  id text primary key,
  queue_id text not null,
  ticket_id text,
  type text not null,
  at bigint not null
);
create index if not exists queue_events_queue_idx on queue_events(queue_id, at);

create table if not exists reviews (
  ord bigint generated always as identity,
  id text primary key,
  business_id text not null references businesses(id) on delete cascade deferrable initially deferred,
  ticket_id text not null,
  rating integer not null check (rating between 1 and 5),
  text text not null default '',
  name text not null default '',
  created_at bigint not null,
  hidden boolean not null default false
);
create index if not exists reviews_business_idx on reviews(business_id);

create table if not exists audit_log (
  ord bigint generated always as identity,
  id text primary key,
  at bigint not null,
  actor text not null,
  action text not null,
  target text not null,
  detail text
);

create table if not exists app_settings (
  id integer primary key default 1 check (id = 1),   -- single row
  data jsonb not null
);

create table if not exists app_meta (
  key text primary key,
  value text not null                                  -- e.g. the session-signing secret
);

-- Lock down the public (PostgREST) API completely.
alter table users          enable row level security;
alter table categories     enable row level security;
alter table businesses     enable row level security;
alter table services       enable row level security;
alter table queues         enable row level security;
alter table tickets        enable row level security;
alter table queue_events   enable row level security;
alter table reviews        enable row level security;
alter table audit_log      enable row level security;
alter table app_settings   enable row level security;
alter table app_meta       enable row level security;
