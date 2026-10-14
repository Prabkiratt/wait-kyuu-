import { db, notify, uid } from "@/lib/store";
import { AppError, joinQueue, nextCustomer, removeTicket, setQueueStatus, skipTicket } from "@/lib/engine";
import { body, handle, json, ownedBusiness, ownedQueue, ownedTicket, rateLimit, requireUser } from "@/lib/server";

type Payload = {
  action?: string; queueId?: string; ticketId?: string; name?: string; phone?: string;
  service?: { name?: string; durationMin?: number; price?: number };
  profile?: { description?: string; phone?: string; imageUrl?: string };
  queue?: { name?: string; avgServiceMin?: number; prefix?: string; maxSize?: number; serviceId?: string };
};

export const POST = handle(async (req: Request) => {
  const user = await requireUser("merchant");
  rateLimit(`merchant:${user.id}`, 120, 60_000);
  const p = await body<Payload>(req);

  // Every action resolves the target through an ownership check; a merchant can never touch another business.
  switch (p.action) {
    case "next": return json({ called: nextCustomer((await ownedQueue(user, p.queueId ?? "")).id)?.number ?? null });
    case "skip": skipTicket(await ownedTicket(user, p.ticketId ?? "")); return json({ ok: true });
    case "remove": removeTicket(await ownedTicket(user, p.ticketId ?? ""), "merchant"); return json({ ok: true });
    case "pause":
    case "resume": setQueueStatus(await ownedQueue(user, p.queueId ?? ""), p.action === "pause" ? "paused" : "open"); return json({ ok: true });
    case "add": {
      const q = await ownedQueue(user, p.queueId ?? "");
      const t = joinQueue(q.id, { name: p.name, phone: p.phone }, "walk-in");
      return json({ number: t.number });
    }
    case "addService": {
      const b = await ownedBusiness(user);
      const name = String(p.service?.name ?? "").trim().slice(0, 60);
      const durationMin = Math.round(Number(p.service?.durationMin));
      if (!name || !(durationMin >= 1 && durationMin <= 600)) throw new AppError("Service needs a name and a duration (1-600 min)");
      const price = p.service?.price === undefined || p.service.price === null ? undefined : Number(p.service.price);
      db.services.push({ id: uid(), businessId: b.id, name, durationMin, price: Number.isFinite(price) ? price : undefined });
      notify();
      return json({ ok: true });
    }
    case "addQueue": {
      const b = await ownedBusiness(user);
      const name = String(p.queue?.name ?? "").trim().slice(0, 60);
      const avg = Math.round(Number(p.queue?.avgServiceMin));
      if (!name || !(avg >= 1 && avg <= 600)) throw new AppError("Queue needs a name and an average service time");
      const used = new Set(db.queues.filter((q) => q.businessId === b.id).map((q) => q.prefix));
      let prefix = String(p.queue?.prefix ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || name[0].toUpperCase();
      for (let c = 65; used.has(prefix) && c <= 90; c++) prefix = String.fromCharCode(c);
      const maxSize = p.queue?.maxSize ? Math.round(Number(p.queue.maxSize)) : undefined;
      db.queues.push({ id: uid(), businessId: b.id, name, prefix, nextSeq: 1, avgServiceMin: avg, status: "open", maxSize: maxSize && maxSize > 0 ? maxSize : undefined, serviceId: p.queue?.serviceId, createdAt: Date.now() });
      notify();
      return json({ ok: true });
    }
    case "setAvg": {
      const q = await ownedQueue(user, p.queueId ?? "");
      const avg = Math.round(Number(p.queue?.avgServiceMin));
      if (!(avg >= 1 && avg <= 600)) throw new AppError("Average must be 1-600 minutes");
      q.avgServiceMin = avg;
      notify();
      return json({ ok: true });
    }
    case "updateProfile": {
      const b = await ownedBusiness(user);
      const f = p.profile ?? {};
      if (f.description !== undefined) b.description = String(f.description).replace(/[<>]/g, "").trim().slice(0, 400);
      if (f.phone !== undefined) {
        const ph = String(f.phone).trim();
        if (!/^[+\d][\d\s-]{6,18}$/.test(ph)) throw new AppError("Enter a valid phone number");
        b.phone = ph;
      }
      if (f.imageUrl !== undefined) {
        const u = String(f.imageUrl).trim();
        if (u && !/^https:\/\/[^\s"<>]{5,400}$/.test(u)) throw new AppError("Photo must be an https:// image link");
        b.imageUrl = u || undefined;
      }
      notify();
      return json({ ok: true });
    }
    case "toggleLive": {
      const b = await ownedBusiness(user);
      b.liveQueue = !b.liveQueue;
      notify();
      return json({ liveQueue: b.liveQueue });
    }
  }
  throw new AppError("Unknown action");
});
