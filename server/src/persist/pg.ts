import fs from "node:fs";
import path from "node:path";
import { Pool, types } from "pg";
import type { DB } from "../../../src/lib/types";
import { DEFAULT_SETTINGS } from "../lib/settings";
import type { Persistence } from "./types";

// bigint (int8) comes back as a string by default; every bigint here is an epoch-ms or a counter that fits in a double.
types.setTypeParser(20, (v) => Number(v));

type Row = Record<string, unknown>;

/** The small slice of `pg` that this module uses, so tests can inject an in-process Postgres. */
export interface QueryClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>;
  release(): void;
}
export interface PoolLike {
  query(text: string, params?: unknown[]): Promise<{ rows: Row[]; rowCount: number | null }>;
  connect(): Promise<QueryClient>;
  end(): Promise<void>;
}

/** One entry per table: how an in-memory entity maps to and from columns. */
interface Spec<T extends { id: string }> {
  table: string;
  key: keyof DB;
  cols: string[];
  json?: string[]; // columns stored as jsonb
  toRow(e: T): unknown[];
  fromRow(r: Row): T;
}

const nz = <V>(v: V | null): V | undefined => (v === null ? undefined : v);
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));

// The specs are loosely typed on purpose: column order in `cols` and `toRow` is the contract.
/* eslint-disable @typescript-eslint/no-explicit-any */
const SPECS: Spec<any>[] = [
  {
    table: "users", key: "users", json: ["favorites"],
    cols: ["id", "email", "pass_hash", "role", "created_at", "name", "picture", "google_id", "status", "favorites", "last_login_at"],
    toRow: (u) => [u.id, u.email, u.passHash ?? null, u.role, u.createdAt, u.name ?? null, u.picture ?? null, u.googleId ?? null, u.status, u.favorites ?? [], u.lastLoginAt ?? null],
    fromRow: (r) => ({ id: r.id, email: r.email, passHash: nz(r.pass_hash), role: r.role, createdAt: num(r.created_at)!, name: nz(r.name), picture: nz(r.picture), googleId: nz(r.google_id), status: r.status, favorites: r.favorites ?? [], lastLoginAt: num(r.last_login_at) }),
  },
  {
    table: "categories", key: "categories", json: ["keywords"],
    cols: ["id", "slug", "name", "icon", "keywords", "image_url"],
    toRow: (c) => [c.id, c.slug, c.name, c.icon ?? "", c.keywords ?? [], c.imageUrl ?? null],
    fromRow: (r) => ({ id: r.id, slug: r.slug, name: r.name, icon: r.icon, keywords: r.keywords ?? [], imageUrl: nz(r.image_url) }),
  },
  {
    table: "businesses", key: "businesses", json: ["gallery", "hours"],
    cols: ["id", "slug", "owner_id", "category_id", "name", "description", "phone", "address", "area", "city", "lat", "lng", "image_url", "gallery", "hue", "hours", "live_queue", "approval", "created_at"],
    toRow: (b) => [b.id, b.slug, b.ownerId, b.categoryId, b.name, b.description ?? "", b.phone ?? "", b.address ?? "", b.area ?? "", b.city ?? "", b.lat, b.lng, b.imageUrl ?? null, b.gallery ?? [], b.hue ?? 0, b.hours, b.liveQueue, b.approval, b.createdAt],
    fromRow: (r) => ({ id: r.id, slug: r.slug, ownerId: r.owner_id, categoryId: r.category_id, name: r.name, description: r.description, phone: r.phone, address: r.address, area: r.area, city: r.city, lat: r.lat, lng: r.lng, imageUrl: nz(r.image_url), gallery: r.gallery ?? [], hue: r.hue, hours: r.hours, liveQueue: r.live_queue, approval: r.approval, createdAt: num(r.created_at)! }),
  },
  {
    table: "services", key: "services",
    cols: ["id", "business_id", "name", "duration_min", "price"],
    toRow: (s) => [s.id, s.businessId, s.name, s.durationMin, s.price ?? null],
    fromRow: (r) => ({ id: r.id, businessId: r.business_id, name: r.name, durationMin: r.duration_min, price: nz(r.price) }),
  },
  {
    table: "queues", key: "queues",
    cols: ["id", "business_id", "name", "service_id", "status", "prefix", "next_seq", "counter", "counter_day", "avg_service_min", "max_size", "created_at"],
    toRow: (q) => [q.id, q.businessId, q.name, q.serviceId ?? null, q.status, q.prefix, q.nextSeq, q.counter ?? null, q.counterDay ?? null, q.avgServiceMin, q.maxSize ?? null, q.createdAt],
    fromRow: (r) => ({ id: r.id, businessId: r.business_id, name: r.name, serviceId: nz(r.service_id), status: r.status, prefix: r.prefix, nextSeq: num(r.next_seq)!, counter: num(r.counter), counterDay: nz(r.counter_day), avgServiceMin: r.avg_service_min, maxSize: nz(r.max_size), createdAt: num(r.created_at)! }),
  },
  {
    table: "tickets", key: "tickets",
    cols: ["id", "queue_id", "business_id", "token", "number", "seq", "name", "phone", "user_id", "status", "source", "joined_at", "called_at", "served_at", "completed_at"],
    toRow: (t) => [t.id, t.queueId, t.businessId, t.token, t.number, t.seq, t.name, t.phone ?? null, t.userId ?? null, t.status, t.source, t.joinedAt, t.calledAt ?? null, t.servedAt ?? null, t.completedAt ?? null],
    fromRow: (r) => ({ id: r.id, queueId: r.queue_id, businessId: r.business_id, token: r.token, number: r.number, seq: num(r.seq)!, name: r.name, phone: nz(r.phone), userId: nz(r.user_id), status: r.status, source: r.source, joinedAt: num(r.joined_at)!, calledAt: num(r.called_at), servedAt: num(r.served_at), completedAt: num(r.completed_at) }),
  },
  {
    table: "queue_events", key: "events",
    cols: ["id", "queue_id", "ticket_id", "type", "at"],
    toRow: (e) => [e.id, e.queueId, e.ticketId ?? null, e.type, e.at],
    fromRow: (r) => ({ id: r.id, queueId: r.queue_id, ticketId: nz(r.ticket_id), type: r.type, at: num(r.at)! }),
  },
  {
    table: "reviews", key: "reviews",
    cols: ["id", "business_id", "ticket_id", "rating", "text", "name", "created_at", "hidden"],
    toRow: (v) => [v.id, v.businessId, v.ticketId, v.rating, v.text ?? "", v.name ?? "", v.createdAt, !!v.hidden],
    fromRow: (r) => ({ id: r.id, businessId: r.business_id, ticketId: r.ticket_id, rating: r.rating, text: r.text, name: r.name, createdAt: num(r.created_at)!, hidden: r.hidden ? true : undefined }),
  },
  {
    table: "audit_log", key: "audit",
    cols: ["id", "at", "actor", "action", "target", "detail"],
    toRow: (a) => [a.id, a.at, a.actor, a.action, a.target, a.detail ?? null],
    fromRow: (r) => ({ id: r.id, at: num(r.at)!, actor: r.actor, action: r.action, target: r.target, detail: nz(r.detail) }),
  },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const CHUNK = 250;

function makePool(connectionString: string): PoolLike {
  const useSsl = !/localhost|127\.0\.0\.1/.test(connectionString) && !/sslmode=disable/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    // Supabase terminates TLS with its own CA; the pooler hostname isn't in that CA's SAN list, so don't verify the chain.
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
  });
  pool.on("error", (e) => console.error("[pg] idle client error:", e.message));
  return pool as unknown as PoolLike;
}

export function pgPersistence(connectionString: string, injected?: PoolLike): Persistence {
  const pool = injected ?? makePool(connectionString);

  /** table -> id -> serialized row currently in the database. Drives write-through diffing. */
  const known = new Map<string, Map<string, string>>();
  let knownSettings = "";
  let knownSecret = "";
  /** Snapshot computed inside a save() transaction; adopted only after COMMIT succeeds. */
  let pending: { next: Map<string, Map<string, string>>; settings: string; secret: string } | null = null;

  async function tx<T>(fn: (c: QueryClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const out = await fn(c);
      await c.query("COMMIT");
      return out;
    } catch (e) {
      await c.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  return {
    name: "postgres",

    async init() {
      const sql = fs.readFileSync(path.join(__dirname, "../../../supabase/migrations/0001_init.sql"), "utf8");
      await pool.query(sql);
    },

    async load() {
      const meta = await pool.query("select value from app_meta where key = 'secret'");
      if (meta.rowCount === 0) return null; // never initialised: caller seeds
      const db = { secret: meta.rows[0].value as string } as DB;
      for (const s of SPECS) {
        const { rows } = await pool.query(`select * from ${s.table} order by ord`);
        const entities = rows.map((r) => s.fromRow(r));
        (db as unknown as Record<string, unknown>)[s.key] = entities;
        known.set(s.table, new Map(entities.map((e: { id: string }) => [e.id, JSON.stringify(s.toRow(e))])));
      }
      const st = await pool.query("select data from app_settings where id = 1");
      db.settings = { ...DEFAULT_SETTINGS, ...(st.rows[0]?.data ?? {}) };
      knownSettings = JSON.stringify(db.settings);
      knownSecret = db.secret;
      return db;
    },

    async save(db) {
      await tx(async (c) => {
        await c.query("SET CONSTRAINTS ALL DEFERRED");
        // delete in reverse dependency order, then upsert in dependency order
        for (const s of [...SPECS].reverse()) {
          const prev = known.get(s.table) ?? new Map<string, string>();
          const current = new Set((db[s.key] as { id: string }[]).map((e) => e.id));
          const gone = [...prev.keys()].filter((id) => !current.has(id));
          if (gone.length) await c.query(`delete from ${s.table} where id = any($1::text[])`, [gone]);
        }
        const next = new Map<string, Map<string, string>>();
        for (const s of SPECS) {
          const prev = known.get(s.table) ?? new Map<string, string>();
          const now = new Map<string, string>();
          const changed: unknown[][] = [];
          for (const e of db[s.key] as { id: string }[]) {
            const row = s.toRow(e);
            const ser = JSON.stringify(row);
            now.set(e.id, ser);
            if (prev.get(e.id) !== ser) changed.push(row);
          }
          for (let i = 0; i < changed.length; i += CHUNK) {
            const part = changed.slice(i, i + CHUNK);
            const params: unknown[] = [];
            const values = part.map((row) => {
              const ph = row.map((v, ci) => {
                const isJson = s.json?.includes(s.cols[ci]);
                params.push(isJson ? JSON.stringify(v) : v);
                return `$${params.length}${isJson ? "::jsonb" : ""}`;
              });
              return `(${ph.join(",")})`;
            });
            const set = s.cols.filter((x) => x !== "id").map((x) => `${x} = excluded.${x}`).join(", ");
            await c.query(`insert into ${s.table} (${s.cols.join(", ")}) values ${values.join(",")} on conflict (id) do update set ${set}`, params);
          }
          next.set(s.table, now);
        }
        const settings = JSON.stringify(db.settings);
        if (settings !== knownSettings) {
          await c.query("insert into app_settings (id, data) values (1, $1::jsonb) on conflict (id) do update set data = excluded.data", [settings]);
        }
        if (db.secret !== knownSecret) {
          await c.query("insert into app_meta (key, value) values ('secret', $1) on conflict (key) do update set value = excluded.value", [db.secret]);
        }
        pending = { next, settings, secret: db.secret };
      });
      if (pending) {
        for (const [t, m] of pending.next) known.set(t, m);
        knownSettings = pending.settings;
        knownSecret = pending.secret;
        pending = null;
      }
    },

    async close() {
      await pool.end();
    },
  };
}
