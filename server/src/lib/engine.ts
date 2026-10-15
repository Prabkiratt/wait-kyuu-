import { dayKey } from "./time";
import { db, notify, token as newToken, uid } from "./store";
import {
  ACTIVE, type Business, type BusinessCard, type BusinessStatus, type Queue, type QueueView, type Ticket, type TicketView,
} from "../../../src/lib/types";

/** Thrown for expected, user-facing failures. Routes turn these into 4xx responses. */
export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Wait threshold (minutes) above which a business is shown as "busy" (amber); double that is red. Admin-configurable. */
export const busyThreshold = () => db.settings.busyThresholdMin;

export function toneOf(status: BusinessStatus, waitMin: number | null): "green" | "amber" | "red" | "gray" {
  if (status === "PAUSED" || status === "QUEUE_FULL") return "red";
  if (status === "CLOSED" || status === "NO_LIVE_DATA" || waitMin === null) return "gray";
  return waitMin < busyThreshold() ? "green" : waitMin < busyThreshold() * 2 ? "amber" : "red";
}

/**
 * Service-time estimator. MVP: the configured average.
 * Future: blend in actual historical service durations (see merchantStats.avgServiceMin) or an ML model.
 */
export function estimateServiceMin(q: Queue): number {
  return q.avgServiceMin;
}

const isActive = (t: Ticket) => ACTIVE.includes(t.status);
export const activeTickets = (queueId: string) =>
  db.tickets.filter((t) => t.queueId === queueId && isActive(t)).sort((a, b) => a.seq - b.seq);

export const bizBySlug = (slug: string) => db.businesses.find((b) => b.slug === slug);
export const bizQueues = (businessId: string) => db.queues.filter((q) => q.businessId === businessId);

// ---------------------------------------------------------------- views

export function queueView(q: Queue): QueueView {
  const active = activeTickets(q.id);
  const serving = active.find((t) => t.status === "SERVING" || t.status === "CALLED");
  const waiting = active.filter((t) => t.status === "WAITING").length;
  const full = q.maxSize !== undefined && waiting >= q.maxSize;
  return {
    id: q.id, name: q.name, status: q.status === "paused" ? "paused" : full ? "full" : "open",
    serving: serving?.number ?? null, waiting, active: active.length, avgServiceMin: estimateServiceMin(q),
    estWaitMin: active.length * estimateServiceMin(q),
  };
}

function localMinutes(b: Business, at = Date.now()) {
  return (((Math.floor(at / 60000) + b.hours.tzOffsetMin) % 1440) + 1440) % 1440;
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export function isOpenNow(b: Business) {
  const now = localMinutes(b), o = toMin(b.hours.open), c = toMin(b.hours.close);
  return o <= c ? now >= o && now <= c : now >= o || now <= c;
}

export function businessStatus(b: Business): { status: BusinessStatus; queues: QueueView[] } {
  const queues = bizQueues(b.id).map(queueView);
  if (!b.liveQueue || queues.length === 0) return { status: "NO_LIVE_DATA", queues };
  if (!isOpenNow(b)) return { status: "CLOSED", queues };
  if (queues.every((q) => q.status === "paused")) return { status: "PAUSED", queues };
  if (queues.filter((q) => q.status !== "paused").every((q) => q.status === "full")) return { status: "QUEUE_FULL", queues };
  return { status: "OPEN", queues };
}

export function ratingOf(businessId: string) {
  const rs = db.reviews.filter((r) => r.businessId === businessId && !r.hidden);
  return { rating: rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : null, count: rs.length };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function businessCard(b: Business, from?: { lat: number; lng: number } | null): BusinessCard {
  const cat = db.categories.find((c) => c.id === b.categoryId)!;
  const { status, queues } = businessStatus(b);
  const joinable = queues.filter((q) => q.status === "open");
  const best = status === "OPEN" ? joinable.sort((x, y) => x.estWaitMin - y.estWaitMin)[0] : undefined;
  const r = ratingOf(b.id);
  return {
    slug: b.slug, name: b.name, category: { slug: cat.slug, name: cat.name, icon: cat.icon },
    rating: r.rating, reviewCount: r.count, area: b.area, city: b.city, lat: b.lat, lng: b.lng,
    distanceKm: from ? Math.round(haversineKm(from.lat, from.lng, b.lat, b.lng) * 10) / 10 : null,
    hue: b.hue, imageUrl: b.imageUrl ?? cat.imageUrl, status, busy: !!best && best.estWaitMin >= busyThreshold(),
    tone: toneOf(status, best ? best.estWaitMin : null),
    // never invent a wait: only live, open queues report one
    waitMin: best ? best.estWaitMin : null, peopleWaiting: best ? best.active : null,
    hoursLabel: `${b.hours.open}–${b.hours.close}`,
    services: db.services.filter((s) => s.businessId === b.id).map((s) => s.name),
    queueCount: queues.length,
  };
}

export function ticketView(t: Ticket): TicketView {
  const q = db.queues.find((x) => x.id === t.queueId)!;
  const b = db.businesses.find((x) => x.id === t.businessId)!;
  const qv = queueView(q);
  const active = isActive(t);
  const ahead = active ? activeTickets(q.id).filter((x) => x.seq < t.seq).length : 0;
  const reviewed = db.reviews.some((r) => r.ticketId === t.id);
  return {
    token: t.token, number: t.number, name: t.name, status: t.status, joinedAt: t.joinedAt,
    queue: { id: q.id, name: q.name, status: qv.status, serving: qv.serving, avgServiceMin: qv.avgServiceMin },
    business: { slug: b.slug, name: b.name, phone: b.phone, address: b.address },
    ahead, estWaitMin: ahead * estimateServiceMin(q), isNext: t.status === "WAITING" && ahead <= 1,
    canReview: t.status === "COMPLETED" && !reviewed, reviewed,
  };
}

// ---------------------------------------------------------------- mutations

function log(queueId: string, type: string, ticketId?: string) {
  db.events.push({ id: uid(), queueId, ticketId, type, at: Date.now() });
  if (db.events.length > 5000) db.events.splice(0, db.events.length - 5000);
}

const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);

export function joinQueue(queueId: string, input: { name: unknown; phone?: unknown; userId?: string }, source: Ticket["source"] = "online"): Ticket {
  const q = db.queues.find((x) => x.id === queueId);
  if (!q) throw new AppError("Queue not found", 404);
  const b = db.businesses.find((x) => x.id === q.businessId)!;
  if (b.approval !== "approved") throw new AppError("This business is not accepting customers", 403);
  const name = clean(input.name, 40);
  if (name.length < 1) throw new AppError("Please enter your name");
  const phone = clean(input.phone, 20);
  if (phone && !/^[+\d][\d\s-]{6,18}$/.test(phone)) throw new AppError("Phone number looks invalid");
  if (source === "online") {
    if (!b.liveQueue) throw new AppError("Live queue unavailable for this business");
    if (!isOpenNow(b)) throw new AppError("This business is currently closed");
  }
  const qv = queueView(q);
  if (q.status === "paused") throw new AppError("This queue is paused right now");
  if (qv.status === "full") throw new AppError("This queue is full right now");

  const seq = q.nextSeq++;
  // display numbers restart every day (A1, A2, ...); seq keeps the strict ordering
  const today = dayKey(Date.now(), b.hours.tzOffsetMin);
  if (q.counterDay !== today) { q.counterDay = today; q.counter = 0; }
  q.counter = (q.counter ?? 0) + 1;
  const t: Ticket = {
    id: uid(), queueId: q.id, businessId: b.id, token: newToken(), number: `${q.prefix}${q.counter}`, seq, name,
    phone: phone || undefined, userId: input.userId, status: "WAITING", source, joinedAt: Date.now(),
  };
  db.tickets.push(t);
  log(q.id, "JOINED", t.id);
  notify();
  return t;
}

/** Complete whoever is being served and call the next waiting customer. */
export function nextCustomer(queueId: string): Ticket | null {
  const now = Date.now();
  const active = activeTickets(queueId);
  for (const t of active) {
    if (t.status === "SERVING" || t.status === "CALLED") {
      t.status = "COMPLETED";
      t.completedAt = now;
      t.servedAt ??= t.calledAt ?? now;
      log(queueId, "COMPLETED", t.id);
    }
  }
  const nxt = active.find((t) => t.status === "WAITING");
  if (nxt) {
    nxt.status = "SERVING";
    nxt.calledAt = now;
    nxt.servedAt = now;
    log(queueId, "SERVING", nxt.id);
  }
  notify();
  return nxt ?? null;
}

/** Skip a no-show. If they were being served/called, the next customer is called. */
export function skipTicket(ticket: Ticket) {
  if (!isActive(ticket)) throw new AppError("Ticket is not active");
  const wasCurrent = ticket.status === "SERVING" || ticket.status === "CALLED";
  ticket.status = "SKIPPED";
  ticket.completedAt = Date.now();
  log(ticket.queueId, "SKIPPED", ticket.id);
  if (wasCurrent) {
    const nxt = activeTickets(ticket.queueId).find((t) => t.status === "WAITING");
    if (nxt) {
      nxt.status = "SERVING";
      nxt.calledAt = nxt.servedAt = Date.now();
      log(ticket.queueId, "SERVING", nxt.id);
    }
  }
  notify();
}

export function removeTicket(ticket: Ticket, by: "merchant" | "customer") {
  if (!isActive(ticket)) throw new AppError("Ticket is not active");
  ticket.status = "CANCELLED";
  ticket.completedAt = Date.now();
  log(ticket.queueId, by === "customer" ? "LEFT" : "REMOVED", ticket.id);
  notify();
}

export function setQueueStatus(q: Queue, status: "open" | "paused") {
  q.status = status;
  log(q.id, status === "paused" ? "PAUSED" : "RESUMED");
  notify();
}

// ---------------------------------------------------------------- merchant dashboard data

const dayStart = (b: Business, at = Date.now()) => {
  const off = b.hours.tzOffsetMin * 60000;
  return Math.floor((at + off) / 864e5) * 864e5 - off;
};
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, c) => a + c, 0) / xs.length / 60000) * 10) / 10 : 0);

export function merchantStats(b: Business) {
  const start = dayStart(b);
  const mine = db.tickets.filter((t) => t.businessId === b.id);
  const today = mine.filter((t) => t.joinedAt >= start);
  const served = mine.filter((t) => t.status === "COMPLETED" && t.completedAt! >= start);
  const lost = today.filter((t) => t.status === "SKIPPED" || t.status === "CANCELLED");
  const peak = Array<number>(24).fill(0);
  const off = b.hours.tzOffsetMin * 60000;
  mine.filter((t) => t.joinedAt >= start - 14 * 864e5).forEach((t) => peak[new Date(t.joinedAt + off).getUTCHours()]++);
  const trend = Array.from({ length: 14 }, (_, i) => {
    const s = start - (13 - i) * 864e5;
    const day = mine.filter((t) => t.status === "COMPLETED" && t.completedAt! >= s && t.completedAt! < s + 864e5);
    return { day: new Date(s + off).toISOString().slice(5, 10), served: day.length };
  });
  const sample = mine.filter((t) => t.status === "COMPLETED" && t.servedAt && t.completedAt);
  return {
    customersToday: today.length,
    served: served.length,
    currentQueue: db.tickets.filter((t) => t.businessId === b.id && isActive(t)).length,
    avgWaitMin: avg(served.filter((t) => t.servedAt).map((t) => t.servedAt! - t.joinedAt)),
    avgServiceMin: avg(sample.slice(-200).map((t) => t.completedAt! - t.servedAt!)),
    abandonmentPct: today.length ? Math.round((lost.length / today.length) * 100) : 0,
    peak, trend,
  };
}

export function merchantView(b: Business) {
  const queues = bizQueues(b.id).map((q) => {
    const all = db.tickets.filter((t) => t.queueId === q.id);
    return {
      ...queueView(q),
      prefix: q.prefix, maxSize: q.maxSize ?? null,
      tickets: activeTickets(q.id).map((t) => ({ id: t.id, number: t.number, name: t.name, phone: t.phone ?? null, status: t.status, source: t.source, joinedAt: t.joinedAt })),
      recent: all.filter((t) => !isActive(t)).sort((a, c) => (c.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 5)
        .map((t) => ({ id: t.id, number: t.number, name: t.name, status: t.status })),
    };
  });
  return {
    business: { id: b.id, slug: b.slug, name: b.name, approval: b.approval, liveQueue: b.liveQueue, description: b.description, phone: b.phone, imageUrl: b.imageUrl ?? null },
    services: db.services.filter((s) => s.businessId === b.id),
    queues, stats: merchantStats(b), status: businessStatus(b).status,
  };
}
