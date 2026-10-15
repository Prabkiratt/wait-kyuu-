/**
 * Persistence tests against a real PostgreSQL engine (PGlite, in-process): the schema file, the
 * write-through diffing and the load path are exercised exactly as they run against Supabase.
 *
 *   npm run test:api
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pgPersistence, type PoolLike } from "../src/persist/pg";
import { buildSeed } from "../src/lib/seed";
import type { DB } from "../../src/lib/types";

/** Adapt PGlite to the tiny pool interface the persistence layer needs. */
function poolFor(pg: PGlite) {
  const stats = { queries: 0, writes: 0 };
  const run = async (text: string, params?: unknown[]) => {
    stats.queries++;
    if (/^\s*(insert|update|delete)/i.test(text)) stats.writes++;
    if (!params || params.length === 0) {
      // multi-statement scripts (the migration, BEGIN/COMMIT) go through exec()
      const rs = await pg.exec(text);
      const last = rs[rs.length - 1];
      return { rows: (last?.rows ?? []) as Record<string, unknown>[], rowCount: last?.rows?.length ?? 0 };
    }
    const r = await pg.query(text, params);
    return { rows: r.rows as Record<string, unknown>[], rowCount: r.rows.length };
  };
  const pool: PoolLike = {
    query: run,
    connect: async () => ({ query: run, release() {} }),
    end: async () => {},
  };
  return { pool, stats };
}

const plain = (d: DB) => JSON.parse(JSON.stringify(d)) as DB;
const URL = "postgres://test/test";

async function fresh() {
  const pg = await PGlite.create();
  const { pool, stats } = poolFor(pg);
  const p = pgPersistence(URL, pool);
  await p.init();
  return { pg, p, stats, pool };
}

test("schema bootstraps and is idempotent; empty store loads as null", async () => {
  const { pg, p } = await fresh();
  assert.equal(await p.load(), null);
  await p.init(); // second run must not fail
  await pg.close();
});

test("a full dataset round-trips through Postgres unchanged", async () => {
  const { pg, p, pool } = await fresh();
  const seed = buildSeed();
  await p.save(seed);

  const loaded = await pgPersistence(URL, pool).load();
  assert.ok(loaded, "load() returns the saved dataset");
  assert.equal(loaded.secret, seed.secret, "session secret persists, so logins survive restarts");
  for (const key of ["users", "categories", "businesses", "services", "queues", "tickets", "events", "reviews", "audit"] as const) {
    assert.deepEqual(plain(loaded)[key], plain(seed)[key], `${key} round-trips`);
  }
  assert.deepEqual(loaded.settings, seed.settings);
  await pg.close();
});

test("only changed rows are written, and changes/deletes are applied", async () => {
  const { pg, p, stats, pool } = await fresh();
  const db = buildSeed();
  await p.save(db);

  stats.writes = 0;
  await p.save(db);
  assert.equal(stats.writes, 0, "an unchanged dataset issues no writes");

  // mutate one ticket, add one, delete a business (children must cascade)
  const queue = db.queues[0];
  const t = db.tickets.find((x) => x.queueId === queue.id && x.status === "WAITING")!;
  t.status = "SERVING";
  t.servedAt = Date.now();
  db.tickets.push({ ...t, id: "new-ticket", token: "tok-new", number: "A999", seq: 99999, status: "WAITING", servedAt: undefined, userId: undefined });
  const victim = db.businesses[3];
  const ticketsBefore = db.tickets.length;
  db.businesses = db.businesses.filter((b) => b.id !== victim.id);
  db.services = db.services.filter((s) => s.businessId !== victim.id);
  const victimQueues = db.queues.filter((q) => q.businessId === victim.id).map((q) => q.id);
  db.queues = db.queues.filter((q) => q.businessId !== victim.id);
  db.tickets = db.tickets.filter((x) => x.businessId !== victim.id);
  db.reviews = db.reviews.filter((r) => r.businessId !== victim.id);
  db.users = db.users.filter((u) => u.id !== victim.ownerId);
  db.settings.announcement = "Hello from a test";

  stats.writes = 0;
  await p.save(db);
  assert.ok(stats.writes > 0 && stats.writes < 12, `a few targeted writes, not a full rewrite (got ${stats.writes})`);

  const reloaded = (await pgPersistence(URL, pool).load())!;
  assert.equal(reloaded.tickets.find((x) => x.id === t.id)?.status, "SERVING");
  assert.ok(reloaded.tickets.some((x) => x.id === "new-ticket"));
  assert.ok(!reloaded.businesses.some((b) => b.id === victim.id), "deleted business is gone");
  assert.ok(!reloaded.queues.some((q) => victimQueues.includes(q.id)));
  assert.ok(reloaded.tickets.length < ticketsBefore + 1);
  assert.equal(reloaded.settings.announcement, "Hello from a test");
  await pg.close();
});

test("re-seeding replaces everything without constraint violations (admin 'reset demo')", async () => {
  const { pg, p, pool } = await fresh();
  const db = buildSeed();
  await p.save(db);
  const secret = db.secret;
  Object.assign(db, buildSeed(), { secret }); // what resetDb() does: all-new ids, same slugs and emails
  await p.save(db);
  const reloaded = (await pgPersistence(URL, pool).load())!;
  assert.equal(reloaded.businesses.length, db.businesses.length);
  assert.equal(reloaded.secret, secret);
  assert.deepEqual(plain(reloaded).tickets.map((t) => t.id).sort(), plain(db).tickets.map((t) => t.id).sort());
  await pg.close();
});

test("row-level security is enabled on every table (the public REST API sees nothing)", async () => {
  const { pg } = await fresh();
  const r = await pg.query<{ relname: string; relrowsecurity: boolean }>(
    "select relname, relrowsecurity from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace",
  );
  assert.ok(r.rows.length >= 11);
  for (const row of r.rows) assert.equal(row.relrowsecurity, true, `${row.relname} has RLS enabled`);
  await pg.close();
});
