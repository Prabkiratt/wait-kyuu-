import { db, notify, uid } from "../lib/store";
import { AppError } from "../lib/engine";
import { body, handle, json, requireUser } from "../lib/server";

interface Input {
  name?: string; categoryId?: string; description?: string; phone?: string; address?: string; area?: string; city?: string;
  lat?: number; lng?: number; imageUrl?: string; open?: string; close?: string;
  services?: { name?: string; durationMin?: number; price?: number }[];
  queue?: { name?: string; avgServiceMin?: number; prefix?: string; maxSize?: number };
}

const str = (v: unknown, max: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export const POST = handle(async (req: Request) => {
  const user = await requireUser("merchant");
  if (db.businesses.some((b) => b.ownerId === user.id)) throw new AppError("This account already has a business");
  const i = await body<Input>(req);

  const name = str(i.name, 60);
  if (name.length < 2) throw new AppError("Business name is required");
  const cat = db.categories.find((c) => c.id === i.categoryId);
  if (!cat) throw new AppError("Choose a category");
  const lat = Number(i.lat), lng = Number(i.lng);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) || (lat === 0 && lng === 0)) throw new AppError("Set your business location");
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  const open = hhmm.test(String(i.open)) ? String(i.open) : "09:00";
  const close = hhmm.test(String(i.close)) ? String(i.close) : "21:00";
  const phone = str(i.phone, 20);
  if (!/^[+\d][\d\s-]{6,18}$/.test(phone)) throw new AppError("Enter a valid business phone");

  const services = (i.services ?? []).slice(0, 30).map((s) => ({
    name: str(s.name, 60), durationMin: Math.round(Number(s.durationMin)), price: s.price === undefined || s.price === null || s.price === ("" as unknown) ? undefined : Number(s.price),
  })).filter((s) => s.name && s.durationMin >= 1 && s.durationMin <= 600);

  const qName = str(i.queue?.name, 60) || "General Queue";
  const avg = Math.round(Number(i.queue?.avgServiceMin) || (services[0]?.durationMin ?? 10));
  if (!(avg >= 1 && avg <= 600)) throw new AppError("Average service time must be 1-600 minutes");

  let slug = slugify(name);
  while (db.businesses.some((b) => b.slug === slug)) slug = `${slugify(name)}-${Math.floor(100 + Math.random() * 900)}`;

  // Approval can be required for production with REQUIRE_APPROVAL=1; otherwise businesses go live right away.
  const approval = (db.settings.requireApproval || process.env.REQUIRE_APPROVAL === "1") ? "pending" : "approved";
  const b = {
    id: uid(), slug, ownerId: user.id, name, categoryId: cat.id, description: str(i.description, 400), phone,
    address: str(i.address, 120), area: str(i.area, 40) || "Nearby", city: str(i.city, 40) || "Bengaluru", lat, lng,
    hue: Math.floor(Math.random() * 360), imageUrl: /^https:\/\/[^\s"<>]{5,300}$/.test(String(i.imageUrl ?? "")) ? String(i.imageUrl) : undefined, gallery: [], hours: { open, close, tzOffsetMin: 330 }, liveQueue: true,
    approval: approval as "pending" | "approved", createdAt: Date.now(),
  };
  db.businesses.push(b);
  const svcRows = services.map((s) => ({ id: uid(), businessId: b.id, ...s, price: Number.isFinite(s.price as number) ? s.price : undefined }));
  db.services.push(...svcRows);
  const prefix = str(i.queue?.prefix, 2).toUpperCase().replace(/[^A-Z]/g, "") || qName[0].toUpperCase();
  const maxSize = i.queue?.maxSize ? Math.round(Number(i.queue.maxSize)) : undefined;
  db.queues.push({ id: uid(), businessId: b.id, name: qName, prefix, nextSeq: 1, avgServiceMin: avg, status: "open", maxSize: maxSize && maxSize > 0 ? maxSize : undefined, createdAt: Date.now() });
  notify();
  return json({ slug, approval });
});
