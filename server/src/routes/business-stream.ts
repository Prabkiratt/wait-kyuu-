import { db } from "../lib/store";
import { AppError, bizBySlug, businessCard, queueView, bizQueues } from "../lib/engine";
import { sse } from "../lib/server";


export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return sse(req, () => {
    const b = bizBySlug(slug);
    if (!b || b.approval === "suspended") throw new AppError("Business not found", 404);
    if (b.approval === "pending") throw new AppError("This business is awaiting approval", 404);
    const card = businessCard(b);
    const cat = db.categories.find((c) => c.id === b.categoryId);
    return {
      card,
      info: { description: b.description, phone: b.phone, address: b.address, hours: b.hours, category: cat?.name, gallery: [b.imageUrl ?? cat?.imageUrl, ...b.gallery].filter(Boolean) },
      services: db.services.filter((s) => s.businessId === b.id).map(({ id, name, durationMin, price }) => ({ id, name, durationMin, price })),
      queues: bizQueues(b.id).map(queueView),
      // reviews expose first name + text only
      reviews: db.reviews.filter((r) => r.businessId === b.id && !r.hidden).sort((x, y) => y.createdAt - x.createdAt).slice(0, 20)
        .map(({ id, rating, text, name, createdAt }) => ({ id, rating, text, name, createdAt })),
    };
  });
}
