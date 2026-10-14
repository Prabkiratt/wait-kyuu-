import { db, notify } from "@/lib/store";
import { AppError, bizBySlug, businessCard, ticketView } from "@/lib/engine";
import { body, currentUser, handle, json, requireUser } from "@/lib/server";

/** Signed-in customer's own data: profile, saved businesses, tickets. */
export const GET = handle(async () => {
  const u = await currentUser();
  if (!u) return json({ user: null });
  const tickets = db.tickets.filter((t) => t.userId === u.id).sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 30);
  return json({
    user: { email: u.email, name: u.name ?? null, picture: u.picture ?? null, role: u.role, since: u.createdAt },
    favorites: u.favorites.map((s) => bizBySlug(s)).filter((b) => b && b.approval === "approved").map((b) => businessCard(b!)),
    favoriteSlugs: u.favorites,
    tickets: tickets.map(ticketView),
  });
});

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const p = await body<{ action?: string; slug?: string; slugs?: string[]; name?: string }>(req);
  if (p.action === "toggleFavorite") {
    if (!p.slug || !bizBySlug(p.slug)) throw new AppError("Business not found", 404);
    u.favorites = u.favorites.includes(p.slug) ? u.favorites.filter((s) => s !== p.slug) : [...u.favorites, p.slug];
  } else if (p.action === "mergeFavorites") {
    // favourites saved in this browser before signing in
    const add = (p.slugs ?? []).filter((s) => typeof s === "string" && bizBySlug(s));
    u.favorites = [...new Set([...u.favorites, ...add])].slice(0, 200);
  } else if (p.action === "updateProfile") {
    u.name = String(p.name ?? "").replace(/[<>]/g, "").trim().slice(0, 60) || undefined;
  } else throw new AppError("Unknown action");
  notify();
  return json({ favoriteSlugs: u.favorites });
});
