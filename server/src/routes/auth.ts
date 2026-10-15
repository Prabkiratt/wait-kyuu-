import { db, notify, uid } from "../lib/store";
import { hashPassword, verifyPassword } from "../lib/password";
import { AppError } from "../lib/engine";
import { body, clientIp, currentUser, endSession, handle, json, rateLimit, startSession } from "../lib/server";
import { DEMO_PASSWORD } from "../lib/seed";
import { audit } from "../lib/audit";
import { googleConfigured } from "../lib/google";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@vouchiq.test";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";
const DEMO_ENABLED = process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1";

function ensureAdmin() {
  if (!db.users.some((u) => u.email === ADMIN_EMAIL && u.role === "admin")) {
    db.users.push({ id: uid(), email: ADMIN_EMAIL, passHash: hashPassword(ADMIN_PASSWORD), role: "admin", createdAt: Date.now(), status: "active", favorites: [], name: "Platform admin" });
    notify();
  }
}

export const GET = handle(async () => {
  const u = await currentUser();
  const providers = { google: googleConfigured() };
  if (!u) return json({ user: null, providers });
  const b = db.businesses.find((x) => x.ownerId === u.id);
  return json({
    user: { email: u.email, role: u.role, name: u.name ?? u.email.split("@")[0], picture: u.picture ?? null },
    business: b ? { slug: b.slug, name: b.name } : null, providers,
  });
});

export const POST = handle(async (req: Request) => {
  rateLimit(`auth:${clientIp(req)}`, 15, 60_000);
  const { action, email, password, demo, role, name } = await body<{ action?: string; email?: string; password?: string; demo?: string; role?: string; name?: string }>(req);

  if (action === "logout") {
    await endSession();
    return json({ ok: true });
  }

  if (action === "demo") {
    // one-click sign-in to a seeded account, for local testing only
    if (!DEMO_ENABLED) throw new AppError("Demo mode is disabled", 403);
    const b = db.businesses.find((x) => x.slug === demo);
    const owner = b ? db.users.find((u) => u.id === b.ownerId) : demo === "customer" ? db.users.find((u) => u.role === "customer") : undefined;
    if (!owner) throw new AppError("Unknown demo account", 404);
    await startSession(owner.id);
    return json({ ok: true, role: owner.role });
  }

  const em = String(email ?? "").trim().toLowerCase();
  const pw = String(password ?? "");
  if (!/^\S+@\S+\.\S+$/.test(em)) throw new AppError("Enter a valid email");

  if (action === "register") {
    if (!db.settings.allowSignups) throw new AppError("New sign-ups are temporarily disabled", 403);
    if (pw.length < 8) throw new AppError("Password must be at least 8 characters");
    if (db.users.some((u) => u.email === em)) throw new AppError("An account with this email already exists");
    const r = role === "customer" ? "customer" : "merchant"; // admin accounts can never be self-registered
    const u = {
      id: uid(), email: em, passHash: hashPassword(pw), role: r as "customer" | "merchant", createdAt: Date.now(),
      status: "active" as const, favorites: [], name: String(name ?? "").trim().slice(0, 60) || undefined, lastLoginAt: Date.now(),
    };
    db.users.push(u);
    notify();
    await startSession(u.id);
    return json({ ok: true, role: u.role });
  }

  if (action === "login") {
    ensureAdmin();
    const u = db.users.find((x) => x.email === em);
    // verify against a dummy hash when the user is unknown or has no password, to keep timing similar
    const ok = verifyPassword(pw, u?.passHash ?? hashPassword(DEMO_PASSWORD));
    if (!u || !u.passHash || !ok) throw new AppError("Wrong email or password", 401);
    if (u.status === "suspended") throw new AppError("This account has been suspended. Contact support.", 403);
    u.lastLoginAt = Date.now();
    if (u.role === "admin") audit(u.email, "admin.login", u.email);
    notify();
    await startSession(u.id);
    return json({ ok: true, role: u.role });
  }
  throw new AppError("Unknown action");
});
