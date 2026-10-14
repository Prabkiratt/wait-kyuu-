import { db, notify, resetDb, uid } from "@/lib/store";
import {
  AppError, activeTickets, businessStatus, joinQueue, nextCustomer, queueView, ratingOf, removeTicket, setQueueStatus, skipTicket,
} from "@/lib/engine";
import { hashPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import { body, handle, json, requireUser } from "@/lib/server";
import { adminEmails, googleConfigured, redirectUri } from "@/lib/google";
import { ACTIVE, type Business, type Role } from "@/lib/types";

const DAY = 864e5;
const day = (t: number) => new Date(t + 330 * 60000).toISOString().slice(5, 10);
const str = (v: unknown, max: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const num = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined);
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
const url = (v: unknown) => { const s = String(v ?? "").trim(); return /^https:\/\/[^\s"<>]{5,400}$/.test(s) ? s : undefined; };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function removeBusiness(b: Business) {
  const qids = db.queues.filter((q) => q.businessId === b.id).map((q) => q.id);
  db.tickets = db.tickets.filter((t) => t.businessId !== b.id);
  db.events = db.events.filter((e) => !qids.includes(e.queueId));
  db.queues = db.queues.filter((q) => q.businessId !== b.id);
  db.services = db.services.filter((s) => s.businessId !== b.id);
  db.reviews = db.reviews.filter((r) => r.businessId !== b.id);
  db.businesses = db.businesses.filter((x) => x.id !== b.id);
}

// ------------------------------------------------------------------ reads
export const GET = handle(async (req: Request) => {
  await requireUser("admin");
  const sp = new URL(req.url).searchParams;
  const view = sp.get("view") ?? "overview";
  const now = Date.now();
  const bizName = (id: string) => db.businesses.find((b) => b.id === id)?.name ?? "(deleted)";
  const catName = (id: string) => db.categories.find((c) => c.id === id)?.name ?? "-";

  if (view === "overview") {
    const since = now - 14 * DAY;
    const recent = db.tickets.filter((t) => t.joinedAt >= since);
    const trend = Array.from({ length: 14 }, (_, i) => {
      const s = now - (13 - i) * DAY;
      const k = day(s);
      return {
        day: k,
        joined: recent.filter((t) => day(t.joinedAt) === k).length,
        served: recent.filter((t) => t.status === "COMPLETED" && t.completedAt && day(t.completedAt) === k).length,
        signups: db.users.filter((u) => day(u.createdAt) === k && now - u.createdAt < 14 * DAY).length,
      };
    });
    const volume = new Map<string, number>();
    recent.forEach((t) => volume.set(t.businessId, (volume.get(t.businessId) ?? 0) + 1));
    const reviews = db.reviews.filter((r) => !r.hidden);
    return json({
      kpis: {
        businesses: db.businesses.length, approved: db.businesses.filter((b) => b.approval === "approved").length,
        pending: db.businesses.filter((b) => b.approval === "pending").length, suspended: db.businesses.filter((b) => b.approval === "suspended").length,
        customers: db.users.filter((u) => u.role === "customer").length, merchants: db.users.filter((u) => u.role === "merchant").length,
        activeTickets: db.tickets.filter((t) => ACTIVE.includes(t.status)).length,
        ticketsToday: db.tickets.filter((t) => now - t.joinedAt < DAY).length, ticketsTotal: db.tickets.length,
        liveQueues: db.queues.filter((q) => q.status === "open").length, queues: db.queues.length,
        avgRating: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null, reviews: reviews.length,
      },
      trend,
      top: [...volume.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ name: bizName(id), tickets: n })),
      categories: db.categories.map((c) => ({ name: c.name, businesses: db.businesses.filter((b) => b.categoryId === c.id).length })).filter((c) => c.businesses > 0),
      pending: db.businesses.filter((b) => b.approval === "pending").slice(0, 5).map((b) => ({ id: b.id, name: b.name, category: catName(b.categoryId) })),
      audit: db.audit.slice(-8).reverse(),
    });
  }

  if (view === "businesses")
    return json({
      categories: db.categories.map((c) => ({ id: c.id, name: c.name })),
      rows: db.businesses.map((b) => {
        const r = ratingOf(b.id);
        return {
          id: b.id, slug: b.slug, name: b.name, area: b.area, city: b.city, category: catName(b.categoryId), approval: b.approval, liveQueue: b.liveQueue,
          status: businessStatus(b).status, owner: db.users.find((u) => u.id === b.ownerId)?.email ?? "-", rating: r.rating, reviews: r.count,
          tickets14d: db.tickets.filter((t) => t.businessId === b.id && t.joinedAt > now - 14 * DAY).length,
          queues: db.queues.filter((q) => q.businessId === b.id).length, imageUrl: b.imageUrl ?? null, createdAt: b.createdAt,
        };
      }),
    });

  if (view === "business") {
    const b = db.businesses.find((x) => x.id === sp.get("id"));
    if (!b) throw new AppError("Not found", 404);
    return json({
      business: b, services: db.services.filter((s) => s.businessId === b.id),
      queues: db.queues.filter((q) => q.businessId === b.id).map((q) => ({ ...q, view: queueView(q) })),
      owner: db.users.find((u) => u.id === b.ownerId)?.email,
    });
  }

  if (view === "queues")
    return json({
      rows: db.queues.map((q) => {
        const v = queueView(q);
        return { id: q.id, name: q.name, business: bizName(q.businessId), businessId: q.businessId, status: q.status, state: v.status, active: v.active, waiting: v.waiting, serving: v.serving, avg: q.avgServiceMin, est: v.estWaitMin, maxSize: q.maxSize ?? null };
      }),
    });

  if (view === "queue") {
    const q = db.queues.find((x) => x.id === sp.get("id"));
    if (!q) throw new AppError("Not found", 404);
    const mk = (t: (typeof db.tickets)[number]) => ({ id: t.id, number: t.number, name: t.name, phone: t.phone ?? null, status: t.status, source: t.source, joinedAt: t.joinedAt });
    return json({
      queue: { id: q.id, name: q.name, business: bizName(q.businessId), status: q.status, avg: q.avgServiceMin }, view: queueView(q),
      active: activeTickets(q.id).map(mk),
      history: db.tickets.filter((t) => t.queueId === q.id && !ACTIVE.includes(t.status)).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 25).map(mk),
    });
  }

  if (view === "users")
    return json({
      rows: db.users.map((u) => ({
        id: u.id, email: u.email, name: u.name ?? null, picture: u.picture ?? null, role: u.role, status: u.status, google: !!u.googleId, password: !!u.passHash,
        business: db.businesses.find((b) => b.ownerId === u.id)?.name ?? null, tickets: db.tickets.filter((t) => t.userId === u.id).length,
        favorites: u.favorites.length, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt ?? null,
      })),
    });

  if (view === "reviews")
    return json({ rows: [...db.reviews].sort((a, b) => b.createdAt - a.createdAt).slice(0, 200).map((r) => ({ ...r, business: bizName(r.businessId) })) });

  if (view === "categories")
    return json({ rows: db.categories.map((c) => ({ ...c, businesses: db.businesses.filter((b) => b.categoryId === c.id).length })) });

  if (view === "tickets") {
    const q = (sp.get("q") ?? "").toLowerCase();
    const st = sp.get("status");
    const rows = db.tickets
      .filter((t) => (!st || t.status === st) && (!q || t.name.toLowerCase().includes(q) || t.number.toLowerCase() === q || bizName(t.businessId).toLowerCase().includes(q)))
      .sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 150)
      .map((t) => ({ id: t.id, number: t.number, name: t.name, phone: t.phone ?? null, status: t.status, source: t.source, business: bizName(t.businessId), queue: db.queues.find((x) => x.id === t.queueId)?.name, joinedAt: t.joinedAt }));
    return json({ rows, total: db.tickets.length });
  }

  if (view === "audit") return json({ rows: [...db.audit].reverse().slice(0, 300) });
  if (view === "settings") return json({ settings: db.settings, google: googleConfigured(), adminEmails: adminEmails().length, callback: redirectUri(new URL(req.url).origin) });
  throw new AppError("Unknown view");
});

// ------------------------------------------------------------------ writes
type P = Record<string, unknown> & { action?: string; id?: string };

export const POST = handle(async (req: Request) => {
  const admin = await requireUser("admin");
  const p = await body<P>(req);
  const log = (action: string, target: string, detail?: string) => { audit(admin.email, action, target, detail); notify(); };
  const biz = (id = p.id) => { const b = db.businesses.find((x) => x.id === id); if (!b) throw new AppError("Business not found", 404); return b; };
  const queue = (id = p.id) => { const q = db.queues.find((x) => x.id === id); if (!q) throw new AppError("Queue not found", 404); return q; };
  const ticket = (id = p.id) => { const t = db.tickets.find((x) => x.id === id); if (!t) throw new AppError("Ticket not found", 404); return t; };
  const user = (id = p.id) => { const u = db.users.find((x) => x.id === id); if (!u) throw new AppError("User not found", 404); return u; };
  const adminsLeft = (except: string) => db.users.filter((u) => u.role === "admin" && u.status === "active" && u.id !== except).length;

  switch (p.action) {
    // ---- businesses
    case "business.approve": case "business.suspend": {
      const b = biz();
      b.approval = p.action === "business.approve" ? "approved" : "suspended";
      log(p.action, b.name);
      return json({ ok: true });
    }
    case "business.update": {
      const b = biz();
      const f = (p.fields ?? {}) as Record<string, unknown>;
      if (f.name !== undefined) { const n = str(f.name, 60); if (n.length < 2) throw new AppError("Name is too short"); b.name = n; }
      if (f.categoryId !== undefined) { if (!db.categories.some((c) => c.id === f.categoryId)) throw new AppError("Unknown category"); b.categoryId = String(f.categoryId); }
      if (f.description !== undefined) b.description = str(f.description, 400);
      if (f.phone !== undefined) b.phone = str(f.phone, 20);
      if (f.address !== undefined) b.address = str(f.address, 120);
      if (f.area !== undefined) b.area = str(f.area, 40);
      if (f.city !== undefined) b.city = str(f.city, 40);
      if (f.lat !== undefined && f.lng !== undefined) { const la = num(f.lat), lo = num(f.lng); if (la === undefined || lo === undefined || Math.abs(la) > 90 || Math.abs(lo) > 180) throw new AppError("Invalid coordinates"); b.lat = la; b.lng = lo; }
      if (f.imageUrl !== undefined) b.imageUrl = f.imageUrl === "" ? undefined : (url(f.imageUrl) ?? (() => { throw new AppError("Image must be an https URL"); })());
      if (f.gallery !== undefined) b.gallery = String(f.gallery).split(/\s+/).map(url).filter((x): x is string => !!x).slice(0, 8);
      if (f.open !== undefined && hhmm.test(String(f.open))) b.hours.open = String(f.open);
      if (f.close !== undefined && hhmm.test(String(f.close))) b.hours.close = String(f.close);
      if (f.liveQueue !== undefined) b.liveQueue = !!f.liveQueue;
      if (f.slug !== undefined) { const s = slugify(String(f.slug)); if (!s) throw new AppError("Invalid slug"); if (db.businesses.some((x) => x.slug === s && x.id !== b.id)) throw new AppError("Slug already in use"); b.slug = s; }
      log("business.update", b.name, Object.keys(f).join(", "));
      return json({ ok: true });
    }
    case "business.delete": { const b = biz(); const n = b.name; removeBusiness(b); log("business.delete", n); return json({ ok: true }); }

    // ---- services
    case "service.save": {
      const b = biz(str(p.businessId, 60));
      const name = str(p.name, 60), dur = num(p.durationMin);
      if (!name || !dur || dur < 1 || dur > 600) throw new AppError("Service needs a name and 1-600 min duration");
      const price = num(p.price);
      const ex = db.services.find((s) => s.id === p.id && s.businessId === b.id);
      if (ex) { ex.name = name; ex.durationMin = Math.round(dur); ex.price = price; }
      else db.services.push({ id: uid(), businessId: b.id, name, durationMin: Math.round(dur), price });
      log("service.save", `${b.name}: ${name}`);
      return json({ ok: true });
    }
    case "service.delete": {
      const s = db.services.find((x) => x.id === p.id);
      if (!s) throw new AppError("Not found", 404);
      db.services = db.services.filter((x) => x.id !== s.id);
      db.queues.forEach((q) => { if (q.serviceId === s.id) q.serviceId = undefined; });
      log("service.delete", s.name);
      return json({ ok: true });
    }

    // ---- queues & tickets
    case "queue.save": {
      const f = (p.fields ?? {}) as Record<string, unknown>;
      const avg = num(f.avgServiceMin);
      if (avg !== undefined && (avg < 1 || avg > 600)) throw new AppError("Average must be 1-600 min");
      let q;
      if (p.id) q = queue();
      else {
        const b = biz(str(p.businessId, 60));
        const name = str(f.name, 60);
        if (!name) throw new AppError("Queue needs a name");
        const used = new Set(db.queues.filter((x) => x.businessId === b.id).map((x) => x.prefix));
        let prefix = name[0].toUpperCase();
        for (let c = 65; used.has(prefix) && c <= 90; c++) prefix = String.fromCharCode(c);
        q = { id: uid(), businessId: b.id, name, prefix, nextSeq: 1, avgServiceMin: avg ?? 10, status: "open" as const, createdAt: Date.now() };
        db.queues.push(q);
      }
      if (f.name !== undefined && p.id) q.name = str(f.name, 60) || q.name;
      if (avg !== undefined) q.avgServiceMin = Math.round(avg);
      if (f.maxSize !== undefined) { const m = num(f.maxSize); q.maxSize = m && m > 0 ? Math.round(m) : undefined; }
      if (f.status === "open" || f.status === "paused") q.status = f.status;
      log("queue.save", q.name);
      return json({ ok: true });
    }
    case "queue.delete": {
      const q = queue();
      db.tickets = db.tickets.filter((t) => t.queueId !== q.id);
      db.queues = db.queues.filter((x) => x.id !== q.id);
      log("queue.delete", q.name);
      return json({ ok: true });
    }
    case "queue.next": { const q = queue(); const t = nextCustomer(q.id); log("queue.next", q.name, t?.number); return json({ called: t?.number ?? null }); }
    case "queue.pause": case "queue.resume": { const q = queue(); setQueueStatus(q, p.action === "queue.pause" ? "paused" : "open"); log(p.action, q.name); return json({ ok: true }); }
    case "queue.clear": {
      const q = queue();
      const active = activeTickets(q.id);
      active.forEach((t) => removeTicket(t, "merchant"));
      log("queue.clear", q.name, `${active.length} tickets cancelled`);
      return json({ ok: true });
    }
    case "ticket.add": { const q = queue(str(p.queueId, 60)); const t = joinQueue(q.id, { name: p.name, phone: p.phone }, "walk-in"); log("ticket.add", q.name, t.number); return json({ number: t.number }); }
    case "ticket.skip": { const t = ticket(); skipTicket(t); log("ticket.skip", t.number); return json({ ok: true }); }
    case "ticket.remove": { const t = ticket(); removeTicket(t, "merchant"); log("ticket.remove", t.number); return json({ ok: true }); }

    // ---- users
    case "user.update": {
      const u = user();
      const f = (p.fields ?? {}) as Record<string, unknown>;
      if (f.name !== undefined) u.name = str(f.name, 60) || undefined;
      if (f.role !== undefined) {
        if (!["customer", "merchant", "admin"].includes(String(f.role))) throw new AppError("Invalid role");
        if (u.role === "admin" && f.role !== "admin" && adminsLeft(u.id) === 0) throw new AppError("You can't remove the last admin");
        u.role = f.role as Role;
      }
      log("user.update", u.email, Object.keys(f).join(", "));
      return json({ ok: true });
    }
    case "user.suspend": case "user.unsuspend": {
      const u = user();
      if (p.action === "user.suspend") {
        if (u.id === admin.id) throw new AppError("You can't suspend yourself");
        if (u.role === "admin" && adminsLeft(u.id) === 0) throw new AppError("You can't suspend the last admin");
      }
      u.status = p.action === "user.suspend" ? "suspended" : "active";
      log(p.action, u.email);
      return json({ ok: true });
    }
    case "user.setPassword": {
      const u = user();
      const pw = String(p.password ?? "");
      if (pw.length < 8) throw new AppError("Password must be at least 8 characters");
      u.passHash = hashPassword(pw);
      log("user.setPassword", u.email);
      return json({ ok: true });
    }
    case "user.delete": {
      const u = user();
      if (u.id === admin.id) throw new AppError("You can't delete yourself");
      if (u.role === "admin" && adminsLeft(u.id) === 0) throw new AppError("You can't delete the last admin");
      if (db.businesses.some((b) => b.ownerId === u.id) && p.withBusiness !== true) throw new AppError("This user owns a business. Delete the business too, or reassign it first.");
      db.businesses.filter((b) => b.ownerId === u.id).forEach(removeBusiness);
      db.tickets.forEach((t) => { if (t.userId === u.id) t.userId = undefined; });
      db.users = db.users.filter((x) => x.id !== u.id);
      log("user.delete", u.email);
      return json({ ok: true });
    }

    // ---- reviews
    case "review.toggle": { const r = db.reviews.find((x) => x.id === p.id); if (!r) throw new AppError("Not found", 404); r.hidden = !r.hidden; log("review.toggle", r.id, r.hidden ? "hidden" : "visible"); return json({ ok: true }); }
    case "review.delete": { const r = db.reviews.find((x) => x.id === p.id); if (!r) throw new AppError("Not found", 404); db.reviews = db.reviews.filter((x) => x.id !== r.id); log("review.delete", r.id); return json({ ok: true }); }

    // ---- categories
    case "category.save": {
      const name = str(p.name, 40);
      if (!name) throw new AppError("Category name required");
      const fields = { name, icon: str(p.icon, 4) || "🏷", imageUrl: p.imageUrl ? url(p.imageUrl) : undefined, keywords: String(p.keywords ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) };
      if (p.id) {
        const c = db.categories.find((x) => x.id === p.id);
        if (!c) throw new AppError("Not found", 404);
        Object.assign(c, fields);
      } else {
        const slug = slugify(name);
        if (!slug || db.categories.some((c) => c.slug === slug)) throw new AppError("A category with that name exists");
        db.categories.push({ id: slug, slug, ...fields });
      }
      log("category.save", name);
      return json({ ok: true });
    }
    case "category.delete": {
      const c = db.categories.find((x) => x.id === p.id);
      if (!c) throw new AppError("Not found", 404);
      if (db.businesses.some((b) => b.categoryId === c.id)) throw new AppError("Move or delete the businesses in this category first");
      db.categories = db.categories.filter((x) => x.id !== c.id);
      log("category.delete", c.name);
      return json({ ok: true });
    }

    // ---- platform
    case "settings.update": {
      const f = (p.fields ?? {}) as Record<string, unknown>;
      const s = db.settings;
      if (f.platformName !== undefined) s.platformName = str(f.platformName, 40) || s.platformName;
      if (f.supportEmail !== undefined) s.supportEmail = str(f.supportEmail, 80);
      if (f.announcement !== undefined) s.announcement = str(f.announcement, 200);
      if (f.requireApproval !== undefined) s.requireApproval = !!f.requireApproval;
      if (f.allowSignups !== undefined) s.allowSignups = !!f.allowSignups;
      if (f.busyThresholdMin !== undefined) { const n = num(f.busyThresholdMin); if (!n || n < 1 || n > 240) throw new AppError("Busy threshold must be 1-240 min"); s.busyThresholdMin = Math.round(n); }
      if (f.rankingWeights) {
        for (const [k, v] of Object.entries(f.rankingWeights as Record<string, unknown>)) {
          const n = num(v);
          if (k in s.rankingWeights && n !== undefined && n >= 0 && n <= 1000) (s.rankingWeights as unknown as Record<string, number>)[k] = n;
        }
      }
      log("settings.update", "platform", Object.keys(f).join(", "));
      return json({ ok: true });
    }
    case "demo.reset": {
      resetDb();
      audit(admin.email, "demo.reset", "all data");
      // the reset re-seeds users, so keep the acting admin able to continue
      if (!db.users.some((u) => u.id === admin.id)) db.users.push({ ...admin });
      notify();
      return json({ ok: true });
    }
  }
  throw new AppError("Unknown action");
});
