import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import type { DB } from "../../../src/lib/types";
import { DEFAULT_SETTINGS } from "./settings";
import { buildBaseSeed, buildSeed, demoAllowed } from "./seed";
import type { Persistence } from "../persist/types";

/**
 * The working dataset lives in memory (fast reads, simple transactional code) and is written through
 * to durable storage after every change. `db` is a stable object: initStore() fills it in place.
 * This server must therefore run as a single instance (see README → Scaling).
 */
const empty = (): DB => ({
  secret: "", settings: structuredClone(DEFAULT_SETTINGS), audit: [],
  users: [], categories: [], businesses: [], services: [], queues: [], tickets: [], events: [], reviews: [],
});

export const db: DB = empty();
export const bus = new EventEmitter().setMaxListeners(0);

let persistence: Persistence | null = null;
let timer: NodeJS.Timeout | undefined;
let chain: Promise<void> = Promise.resolve();
let dirty = false;

/** Fill in fields added after data was written by an older version. */
export function migrate(d: DB): DB {
  d.settings = { ...DEFAULT_SETTINGS, ...d.settings, rankingWeights: { ...DEFAULT_SETTINGS.rankingWeights, ...d.settings?.rankingWeights } };
  d.audit ??= [];
  d.events ??= [];
  d.users.forEach((u) => { u.status ??= "active"; u.favorites ??= []; });
  d.businesses.forEach((b) => { b.gallery ??= []; });
  if (!d.secret) d.secret = crypto.randomBytes(32).toString("hex");
  return d;
}

/** Load from storage (seeding on first run) and attach persistence. Call once before serving traffic. */
export async function initStore(p: Persistence) {
  await p.init();
  const loaded = await p.load();
  // First boot: demo data in development; a clean catalogue in production unless SEED_DEMO=1 / DEMO_MODE=1.
  const data = migrate(loaded ?? (demoAllowed() ? buildSeed() : buildBaseSeed()));
  Object.assign(db, data);
  persistence = p;
  if (!loaded) {
    console.log(`[store] empty ${p.name} store: seeding ${demoAllowed() ? "demo data" : "base catalogue only"}`);
    await p.save(db);
  }
  console.log(`[store] ready (${p.name}): ${db.businesses.length} businesses, ${db.tickets.length} tickets`);
}

function schedule() {
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(() => void flushStore(), 150);
}

/** Write pending changes now. Safe to call repeatedly; writes are serialized. */
export function flushStore(): Promise<void> {
  clearTimeout(timer);
  chain = chain.then(async () => {
    if (!persistence || !dirty) return;
    dirty = false;
    try {
      await persistence.save(db);
    } catch (e) {
      dirty = true; // retry on the next change or flush
      console.error("[store] persist failed:", (e as Error).message);
    }
  });
  return chain;
}

/** Replace all data in place (keeps module references valid). */
export function resetDb() {
  const secret = db.secret; // keep the signing secret so existing sessions (e.g. the admin's) survive a reset
  Object.assign(db, migrate(buildSeed()));
  db.secret = secret;
  notify();
}

/** Call after every mutation: wakes live streams and schedules persistence. */
export function notify() {
  bus.emit("change");
  schedule();
}

export const uid = () => crypto.randomUUID();
export const token = () => crypto.randomBytes(18).toString("base64url");
