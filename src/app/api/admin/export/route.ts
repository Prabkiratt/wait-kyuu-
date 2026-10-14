import { db } from "@/lib/store";
import { AppError } from "@/lib/engine";
import { audit } from "@/lib/audit";
import { handle, requireUser } from "@/lib/server";

// Guard against CSV/formula injection when the file is opened in a spreadsheet.
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (head: string[], rows: unknown[][]) => [head, ...rows].map((r) => r.map(cell).join(",")).join("\n");

export const GET = handle(async (req: Request) => {
  const admin = await requireUser("admin");
  const type = new URL(req.url).searchParams.get("type");
  const iso = (t?: number) => (t ? new Date(t).toISOString() : "");
  let body: string;
  if (type === "businesses")
    body = csv(["name", "slug", "category", "area", "city", "approval", "live_queue", "owner", "created"],
      db.businesses.map((b) => [b.name, b.slug, db.categories.find((c) => c.id === b.categoryId)?.name, b.area, b.city, b.approval, b.liveQueue, db.users.find((u) => u.id === b.ownerId)?.email, iso(b.createdAt)]));
  else if (type === "users")
    body = csv(["email", "name", "role", "status", "created", "last_login"], db.users.map((u) => [u.email, u.name, u.role, u.status, iso(u.createdAt), iso(u.lastLoginAt)]));
  else if (type === "tickets")
    body = csv(["number", "business", "queue", "status", "source", "joined", "completed"],
      db.tickets.slice(-5000).map((t) => [t.number, db.businesses.find((b) => b.id === t.businessId)?.name, db.queues.find((q) => q.id === t.queueId)?.name, t.status, t.source, iso(t.joinedAt), iso(t.completedAt)]));
  else throw new AppError("Unknown export");
  audit(admin.email, "export", type!);
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}.csv"`, "Cache-Control": "no-store" } });
});
