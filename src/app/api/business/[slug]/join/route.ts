import { AppError, bizBySlug, bizQueues, joinQueue } from "@/lib/engine";
import { body, clientIp, currentUser, handle, json, rateLimit } from "@/lib/server";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  rateLimit(`join:${clientIp(req)}`, 8, 60_000);
  const b = bizBySlug(slug);
  if (!b || b.approval !== "approved") throw new AppError("Business not found", 404);
  const { queueId, name, phone } = await body<{ queueId?: string; name?: string; phone?: string }>(req);
  const q = bizQueues(b.id).find((x) => x.id === queueId) ?? (bizQueues(b.id).length === 1 ? bizQueues(b.id)[0] : undefined);
  if (!q) throw new AppError("Please choose a queue");
  const t = joinQueue(q.id, { name, phone, userId: (await currentUser())?.id }, "online");
  return json({ token: t.token, number: t.number });
});
