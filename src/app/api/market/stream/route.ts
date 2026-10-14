import { db } from "@/lib/store";
import { areas, searchMarket } from "@/lib/market";
import { marketParams } from "@/lib/params";
import { sse } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Live marketplace results: re-pushed whenever any queue changes. */
export async function GET(req: Request) {
  const p = marketParams(new URL(req.url).searchParams);
  return sse(req, () => ({
    results: searchMarket(p),
    categories: db.categories.map(({ slug, name, icon, imageUrl }) => ({ slug, name, icon, imageUrl })),
    areas: areas(),
    rankingNote: "Relevance = text match only (name, category, service, area). No paid placement.",
  }));
}
