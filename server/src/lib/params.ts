import type { MarketParams } from "./market";

const num = (v: string | null) => {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function marketParams(sp: URLSearchParams): MarketParams {
  const sort = sp.get("sort");
  return {
    q: sp.get("q")?.slice(0, 80) || undefined,
    cat: sp.get("cat") || undefined,
    lat: num(sp.get("lat")), lng: num(sp.get("lng")),
    openNow: sp.get("open") === "1", liveOnly: sp.get("live") === "1",
    maxWait: num(sp.get("maxWait")), minRating: num(sp.get("minRating")),
    service: sp.get("service")?.slice(0, 40) || undefined,
    sort: sort === "distance" || sort === "wait" || sort === "rating" || sort === "relevance" ? sort : undefined,
  };
}
