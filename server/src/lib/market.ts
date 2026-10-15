import { db } from "./store";
import { businessCard } from "./engine";
import type { BusinessCard } from "../../../src/lib/types";

/**
 * Transparent ranking. "relevance" is ONLY a text-match score using the weights in platform settings
 * (admin → Settings). There are no hidden boosts: no paid placement, no wait-time bias.
 */
export const RANKING_TIE_BREAK = "distance, then shorter wait, then name";

export interface MarketParams {
  q?: string; cat?: string; lat?: number; lng?: number; openNow?: boolean; liveOnly?: boolean;
  maxWait?: number; minRating?: number; service?: string; sort?: "relevance" | "distance" | "wait" | "rating";
}

const STOP = new Set(["near", "me", "in", "at", "the", "for", "a", "an", "nearby", "around", "best", "my", "to", "of"]);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
const stem = (t: string) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t);

export function searchMarket(p: MarketParams) {
  const W = db.settings.rankingWeights;
  const from = p.lat !== undefined && p.lng !== undefined ? { lat: p.lat, lng: p.lng } : null;
  const tokens = norm(p.q ?? "").split(/\s+/).filter((t) => t && !STOP.has(t)).map(stem);

  const rows = db.businesses
    .filter((b) => b.approval === "approved")
    .map((b) => {
      const cat = db.categories.find((c) => c.id === b.categoryId)!;
      const svcs = db.services.filter((s) => s.businessId === b.id).map((s) => norm(s.name));
      const fields = {
        name: norm(b.name), category: norm(cat.name), kw: cat.keywords.map(norm), svc: svcs,
        area: norm(`${b.area} ${b.city}`), desc: norm(b.description),
      };
      let score = 0;
      for (const t of tokens) {
        let hit = 0;
        if (fields.name.includes(t)) hit = Math.max(hit, W.name);
        if (fields.category.includes(t)) hit = Math.max(hit, W.category);
        if (fields.kw.some((k) => k.includes(t))) hit = Math.max(hit, W.categoryKeyword);
        if (fields.svc.some((s) => s.includes(t))) hit = Math.max(hit, W.service);
        if (fields.area.includes(t)) hit = Math.max(hit, W.area);
        if (fields.desc.includes(t)) hit = Math.max(hit, W.description);
        if (!hit) return null; // every query word must match something
        score += hit;
      }
      return { card: businessCard(b, from), score, catSlug: cat.slug };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const svcQ = p.service ? norm(p.service) : "";
  let out = rows.filter((r) => {
    const c = r.card;
    if (p.cat && r.catSlug !== p.cat) return false;
    if (p.openNow && c.status === "CLOSED") return false;
    if (p.liveOnly && c.waitMin === null) return false;
    if (p.maxWait !== undefined && (c.waitMin === null || c.waitMin > p.maxWait)) return false;
    if (p.minRating !== undefined && (c.rating ?? 0) < p.minRating) return false;
    if (svcQ && !c.services.some((s) => norm(s).includes(svcQ))) return false;
    return true;
  });

  const sort = p.sort ?? "relevance";
  const dist = (c: BusinessCard) => c.distanceKm ?? 1e9;
  const wait = (c: BusinessCard) => c.waitMin ?? 1e9; // businesses without live data sort last
  out = out.sort((a, b) => {
    const A = a.card, B = b.card;
    const by =
      sort === "distance" ? dist(A) - dist(B) :
      sort === "wait" ? wait(A) - wait(B) :
      sort === "rating" ? (B.rating ?? 0) - (A.rating ?? 0) :
      b.score - a.score;
    return by || dist(A) - dist(B) || wait(A) - wait(B) || A.name.localeCompare(B.name);
  });

  return out.map((r) => r.card);
}

export function areas() {
  const m = new Map<string, { name: string; lat: number; lng: number; n: number }>();
  for (const b of db.businesses.filter((x) => x.approval === "approved")) {
    const a = m.get(b.area) ?? { name: b.area, lat: 0, lng: 0, n: 0 };
    a.lat += b.lat; a.lng += b.lng; a.n++;
    m.set(b.area, a);
  }
  return [...m.values()].map((a) => ({ name: a.name, lat: a.lat / a.n, lng: a.lng / a.n }));
}
