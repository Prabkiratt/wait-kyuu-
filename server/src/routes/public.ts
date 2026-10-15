import { db } from "../lib/store";
import { ACTIVE } from "../../../src/lib/types";
import { areas } from "../lib/market";
import { googleConfigured } from "../lib/google";
import { handle, json } from "../lib/server";

const DEMO_ENABLED = () => process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1";

/** Everything the frontend needs to render shared chrome and landing data, in one cacheable call. */
export const GET = handle(async () => {
  const approved = db.businesses.filter((b) => b.approval === "approved");
  const liveQueues = db.queues.filter((q) => q.status === "open" && approved.some((b) => b.id === q.businessId && b.liveQueue)).length;
  return json({
    platformName: db.settings.platformName,
    announcement: db.settings.announcement,
    supportEmail: db.settings.supportEmail,
    googleEnabled: googleConfigured(),
    demo: DEMO_ENABLED() ? { businesses: db.businesses.slice(0, 11).map((b) => ({ slug: b.slug, name: b.name })) } : null,
    categories: db.categories.map(({ id, slug, name, icon, imageUrl }) => ({ id, slug, name, icon, imageUrl })),
    areas: areas(),
    stats: {
      businesses: approved.length,
      liveQueues,
      waiting: db.tickets.filter((t) => ACTIVE.includes(t.status)).length,
      served: db.tickets.filter((t) => t.status === "COMPLETED").length,
    },
  });
});
