-- Vouchiq Queue: production schema for Supabase / PostgreSQL.
-- The running MVP uses a local store behind the same domain model (see README); this file is the
-- migration target. Everything is generic: business -> category -> services -> queues -> tickets.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists postgis;            -- distance / nearby queries

-- ------------------------------------------------------------------ enums
create type ticket_status   as enum ('WAITING','CALLED','SERVING','COMPLETED','SKIPPED','CANCELLED');
create type approval_status as enum ('pending','approved','suspended');
create type queue_state     as enum ('open','paused');
create type app_role        as enum ('merchant','staff','admin');

-- ------------------------------------------------------------------ identity
-- auth.users is managed by Supabase Auth; profiles carries the app role.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role app_role not null default 'merchant',
  display_name text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ catalog (database-driven categories)
create table business_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  icon text,
  keywords text[] not null default '{}',
  sort int not null default 0
);

create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  owner_id uuid not null references profiles(id),
  category_id uuid not null references business_categories(id),
  name text not null check (char_length(name) between 2 and 60),
  description text,
  phone text,
  image_url text,
  live_queue boolean not null default true,       -- false => "Live queue unavailable"
  approval approval_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index on businesses using gin (name gin_trgm_ops);

create table business_locations (                 -- branches: a business may have many
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  label text, address text, area text, city text,
  geo geography(point, 4326) not null,
  tz text not null default 'Asia/Kolkata'
);
create index on business_locations using gist (geo);

create table business_hours (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references business_locations on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null, closes time not null
);

create table business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  name text not null, duration_min int not null check (duration_min between 1 and 600),
  price numeric(10,2)
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  user_id uuid not null references profiles(id),
  role text not null default 'operator',
  unique (business_id, user_id)
);

-- ------------------------------------------------------------------ queue engine
create table queues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  location_id uuid references business_locations,
  service_id uuid references business_services,
  name text not null,
  status queue_state not null default 'open',
  prefix text not null default 'A',
  next_seq bigint not null default 1,             -- strict ordering
  counter int not null default 0,                 -- display number, reset daily
  counter_day date,
  avg_service_min int not null default 10,       -- MVP estimator input
  max_size int,
  created_at timestamptz not null default now()
);

create table customer_sessions (                  -- anonymous customers: no account needed
  id uuid primary key default gen_random_uuid(),
  token_hash bytea unique not null,               -- sha256 of the secret in the ticket URL
  user_id uuid references profiles(id),           -- optional: claimed later
  created_at timestamptz not null default now()
);

create table queue_tickets (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references queues on delete cascade,
  business_id uuid not null references businesses on delete cascade,
  session_id uuid references customer_sessions,
  seq bigint not null,
  number text not null,
  customer_name text not null check (char_length(customer_name) between 1 and 40),
  phone text,                                     -- never exposed to customers or the public
  status ticket_status not null default 'WAITING',
  source text not null default 'online',
  joined_at timestamptz not null default now(),
  called_at timestamptz, served_at timestamptz, completed_at timestamptz,
  unique (queue_id, seq)
);
create index on queue_tickets (queue_id, status, seq);

create table queue_events (                       -- audit log; feeds analytics + future ML wait prediction
  id bigserial primary key,
  queue_id uuid not null references queues on delete cascade,
  ticket_id uuid references queue_tickets,
  type text not null,
  at timestamptz not null default now()
);

-- ------------------------------------------------------------------ marketplace extras
create table reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  ticket_id uuid not null unique references queue_tickets,   -- one review per real, completed visit
  rating smallint not null check (rating between 1 and 5),
  body text, author text, hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create table favorites (
  user_id uuid references profiles on delete cascade,
  business_id uuid references businesses on delete cascade,
  primary key (user_id, business_id)
);
create table notifications (                      -- future: WhatsApp / SMS / push
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references queue_tickets on delete cascade,
  channel text not null, payload jsonb, sent_at timestamptz
);
create table qr_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses on delete cascade,
  location_id uuid references business_locations,
  path text unique not null                       -- e.g. /join/style-studio-123
);

-- ------------------------------------------------------------------ authorization helpers
create function is_admin() returns boolean language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create function manages_business(b uuid) returns boolean language sql stable security definer as $$
  select is_admin()
      or exists (select 1 from businesses where id = b and owner_id = auth.uid())
      or exists (select 1 from staff where business_id = b and user_id = auth.uid()) $$;

-- ------------------------------------------------------------------ row level security
alter table profiles            enable row level security;
alter table business_categories enable row level security;
alter table businesses          enable row level security;
alter table business_locations  enable row level security;
alter table business_hours      enable row level security;
alter table business_services   enable row level security;
alter table staff               enable row level security;
alter table queues              enable row level security;
alter table customer_sessions   enable row level security;
alter table queue_tickets       enable row level security;
alter table queue_events        enable row level security;
alter table reviews             enable row level security;
alter table favorites           enable row level security;
alter table notifications       enable row level security;
alter table qr_codes            enable row level security;

create policy "own profile"        on profiles for select using (id = auth.uid() or is_admin());
create policy "categories public"  on business_categories for select using (true);
create policy "admin categories"   on business_categories for all using (is_admin()) with check (is_admin());

-- Public marketplace reads: approved businesses only
create policy "public businesses"  on businesses for select using (approval = 'approved' or manages_business(id));
create policy "owner writes"       on businesses for insert with check (owner_id = auth.uid());
create policy "owner updates"      on businesses for update using (manages_business(id)) with check (manages_business(id) and (approval = 'pending' or is_admin() or approval = (select approval from businesses b where b.id = businesses.id)));
create policy "public locations"   on business_locations for select using (exists (select 1 from businesses b where b.id = business_id and (b.approval = 'approved' or manages_business(b.id))));
create policy "manage locations"   on business_locations for all using (manages_business(business_id)) with check (manages_business(business_id));
create policy "public hours"       on business_hours for select using (true);
create policy "manage hours"       on business_hours for all using (manages_business((select business_id from business_locations l where l.id = location_id))) with check (true);
create policy "public services"    on business_services for select using (exists (select 1 from businesses b where b.id = business_id and b.approval = 'approved') or manages_business(business_id));
create policy "manage services"    on business_services for all using (manages_business(business_id)) with check (manages_business(business_id));
create policy "public queues"      on queues for select using (exists (select 1 from businesses b where b.id = business_id and b.approval = 'approved') or manages_business(business_id));
create policy "manage queues"      on queues for all using (manages_business(business_id)) with check (manages_business(business_id));
create policy "staff visible"      on staff for select using (manages_business(business_id));
create policy "admin staff"        on staff for all using (is_admin()) with check (is_admin());

-- Tickets: ONLY the business can read rows. Customers never query this table directly;
-- they use the security-definer functions below, keyed by their secret token.
create policy "business tickets"   on queue_tickets for all using (manages_business(business_id)) with check (manages_business(business_id));
create policy "business events"    on queue_events for select using (manages_business((select business_id from queues q where q.id = queue_id)));
create policy "sessions: none"     on customer_sessions for select using (user_id = auth.uid());

create policy "reviews public"     on reviews for select using (not hidden or is_admin());
create policy "admin reviews"      on reviews for update using (is_admin());
create policy "own favorites"      on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "qr public"          on qr_codes for select using (true);
create policy "manage qr"          on qr_codes for all using (manages_business(business_id)) with check (manages_business(business_id));

-- ------------------------------------------------------------------ public, safe views / RPCs
-- Aggregated queue status for the marketplace: no customer data at all.
create view public_queue_status with (security_invoker = false) as
select q.id as queue_id, q.business_id, q.name, q.status, q.avg_service_min,
       count(t.*) filter (where t.status in ('WAITING','CALLED','SERVING'))                 as active,
       count(t.*) filter (where t.status = 'WAITING')                                       as waiting,
       max(t.number) filter (where t.status in ('SERVING','CALLED'))                        as serving,
       count(t.*) filter (where t.status in ('WAITING','CALLED','SERVING')) * q.avg_service_min as est_wait_min
from queues q join businesses b on b.id = q.business_id and b.approval = 'approved'
left join queue_tickets t on t.queue_id = q.id
group by q.id;
grant select on public_queue_status to anon, authenticated;

-- Join anonymously; returns the secret token ONCE (store only its hash).
create function join_queue(p_queue uuid, p_name text, p_phone text default null)
returns table (token text, number text) language plpgsql security definer as $$
declare v_token text := encode(gen_random_bytes(18), 'base64'); v_sess uuid; v_q queues; v_seq bigint; v_n int;
begin
  select * into v_q from queues where id = p_queue for update;
  if not found or v_q.status <> 'open' then raise exception 'Queue unavailable'; end if;
  if not exists (select 1 from businesses where id = v_q.business_id and approval = 'approved' and live_queue) then raise exception 'Business unavailable'; end if;
  if v_q.max_size is not null and (select count(*) from queue_tickets where queue_id = p_queue and status = 'WAITING') >= v_q.max_size then raise exception 'Queue full'; end if;
  if v_q.counter_day is distinct from current_date then v_q.counter := 0; end if;
  v_n := v_q.counter + 1; v_seq := v_q.next_seq;
  update queues set next_seq = v_seq + 1, counter = v_n, counter_day = current_date where id = p_queue;
  insert into customer_sessions (token_hash) values (digest(v_token, 'sha256')) returning id into v_sess;
  insert into queue_tickets (queue_id, business_id, session_id, seq, number, customer_name, phone)
    values (p_queue, v_q.business_id, v_sess, v_seq, v_q.prefix || v_n, left(trim(p_name), 40), p_phone);
  insert into queue_events (queue_id, type) values (p_queue, 'JOINED');
  return query select v_token, v_q.prefix || v_n;
end $$;

-- A customer's own view: position, people ahead, wait. Never returns anyone else's data or any phone number.
create function my_ticket(p_token text)
returns table (number text, status ticket_status, serving text, ahead bigint, est_wait_min bigint, queue_name text, business text)
language sql stable security definer as $$
  select t.number, t.status,
         (select max(x.number) from queue_tickets x where x.queue_id = t.queue_id and x.status in ('SERVING','CALLED')),
         (select count(*) from queue_tickets x where x.queue_id = t.queue_id and x.seq < t.seq and x.status in ('WAITING','CALLED','SERVING')),
         (select count(*) from queue_tickets x where x.queue_id = t.queue_id and x.seq < t.seq and x.status in ('WAITING','CALLED','SERVING')) * q.avg_service_min,
         q.name, b.name
  from queue_tickets t join customer_sessions s on s.id = t.session_id
  join queues q on q.id = t.queue_id join businesses b on b.id = t.business_id
  where s.token_hash = digest(p_token, 'sha256') $$;

-- Merchant: complete the current customer and call the next one (atomic).
create function next_customer(p_queue uuid) returns text language plpgsql security definer as $$
declare v_biz uuid; v_next queue_tickets;
begin
  select business_id into v_biz from queues where id = p_queue;
  if not manages_business(v_biz) then raise exception 'Forbidden'; end if;
  update queue_tickets set status = 'COMPLETED', completed_at = now() where queue_id = p_queue and status in ('SERVING','CALLED');
  select * into v_next from queue_tickets where queue_id = p_queue and status = 'WAITING' order by seq limit 1 for update skip locked;
  if found then
    update queue_tickets set status = 'SERVING', called_at = now(), served_at = now() where id = v_next.id;
    insert into queue_events (queue_id, ticket_id, type) values (p_queue, v_next.id, 'SERVING');
    return v_next.number;
  end if;
  return null;
end $$;

-- ------------------------------------------------------------------ realtime
-- Customers subscribe to a broadcast channel per queue (queue:<id>); a trigger publishes the
-- recomputed public status, so no table with customer data is ever exposed over Realtime.
create function broadcast_queue_change() returns trigger language plpgsql security definer as $$
begin
  perform realtime.send(jsonb_build_object('queue', coalesce(new.queue_id, old.queue_id)), 'queue_changed', 'queue:' || coalesce(new.queue_id, old.queue_id), false);
  return null;
end $$;
create trigger queue_tickets_changed after insert or update or delete on queue_tickets
  for each row execute function broadcast_queue_change();
