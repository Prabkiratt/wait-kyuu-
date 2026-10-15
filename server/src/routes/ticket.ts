import { db, notify, uid } from "../lib/store";
import { AppError, removeTicket } from "../lib/engine";
import { body, clientIp, handle, json, rateLimit } from "../lib/server";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  rateLimit(`ticket:${clientIp(req)}`, 20, 60_000);
  const t = db.tickets.find((x) => x.token === token);
  if (!t) throw new AppError("Ticket not found", 404);
  const b = await body<{ action?: string; rating?: number; text?: string }>(req);

  if (b.action === "leave") {
    removeTicket(t, "customer");
    return json({ ok: true });
  }
  if (b.action === "review") {
    // reviews are tied to a real, completed visit
    if (t.status !== "COMPLETED") throw new AppError("You can review after you've been served");
    if (db.reviews.some((r) => r.ticketId === t.id)) throw new AppError("Already reviewed");
    const rating = Math.round(Number(b.rating));
    if (!(rating >= 1 && rating <= 5)) throw new AppError("Rating must be 1-5");
    db.reviews.push({
      id: uid(), businessId: t.businessId, ticketId: t.id, rating,
      text: String(b.text ?? "").replace(/[<>]/g, "").trim().slice(0, 500), name: t.name.split(" ")[0], createdAt: Date.now(),
    });
    notify();
    return json({ ok: true });
  }
  throw new AppError("Unknown action");
});
