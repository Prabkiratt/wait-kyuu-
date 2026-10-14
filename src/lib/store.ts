import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import type { DB } from "./types";
import { DEFAULT_SETTINGS } from "./settings";
import { buildSeed } from "./seed";

const FILE = path.join(process.cwd(), ".data", "db.json");
const g = globalThis as unknown as { __vq_db?: DB; __vq_bus?: EventEmitter; __vq_timer?: NodeJS.Timeout };

function load(): DB {
  try {
    if (fs.existsSync(FILE)) return migrate(JSON.parse(fs.readFileSync(FILE, "utf8")) as DB);
  } catch {
    /* corrupt file: fall through to reseed */
  }
  const fresh = buildSeed();
  persist(fresh);
  return fresh;
}

/** Fill in fields added after a data file was written. */
function migrate(d: DB): DB {
  d.settings = { ...DEFAULT_SETTINGS, ...d.settings, rankingWeights: { ...DEFAULT_SETTINGS.rankingWeights, ...d.settings?.rankingWeights } };
  if ((d.settings.platformName as string) === "Vouchiq Queue") d.settings.platformName = DEFAULT_SETTINGS.platformName; // renamed
  if ((d.settings.supportEmail as string) === "support@vouchiq.test") d.settings.supportEmail = DEFAULT_SETTINGS.supportEmail;
  d.audit ??= [];
  d.users.forEach((u) => { u.status ??= "active"; u.favorites ??= []; });
  d.businesses.forEach((b) => { b.gallery ??= []; });
  return d;
}

function persist(data: DB) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data));
  } catch {
    /* read-only filesystem (serverless): stay in-memory */
  }
}

export const db: DB = migrate((g.__vq_db ??= load())); // idempotent: heals data created by an older code version
export const bus: EventEmitter = (g.__vq_bus ??= new EventEmitter().setMaxListeners(0));

/** Replace all data in place (keeps module references valid). */
export function resetDb() {
  const fresh = buildSeed();
  Object.assign(db, fresh);
  notify();
}

/** Call after every mutation: schedules persistence and wakes all live streams. */
export function notify() {
  bus.emit("change");
  clearTimeout(g.__vq_timer);
  g.__vq_timer = setTimeout(() => persist(db), 250);
}

export const uid = () => crypto.randomUUID();
export const token = () => crypto.randomBytes(18).toString("base64url");
