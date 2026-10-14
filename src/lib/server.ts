import crypto from "node:crypto";
import { cookies } from "next/headers";
import { bus, db } from "./store";
import { AppError } from "./engine";
import type { Business, Queue, Ticket, User } from "./types";

// ------------------------------------------------------------- sessions (signed cookie)
const COOKIE = "vq_session";
const TTL = 7 * 864e5;
const sign = (v: string) => crypto.createHmac("sha256", db.secret).update(v).digest("base64url");

export async function startSession(userId: string) {
  const v = `${userId}.${Date.now() + TTL}`;
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL / 1000, secure: process.env.NODE_ENV === "production" });
}
export async function endSession() {
  (await cookies()).delete(COOKIE);
}
export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  const v = `${id}.${exp}`;
  const good = sig && Buffer.from(sig).length === Buffer.from(sign(v)).length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(v)));
  if (!good || Number(exp) < Date.now()) return null;
  const u = db.users.find((x) => x.id === id);
  return u && u.status !== "suspended" ? u : null; // suspended accounts lose access immediately
}
export async function requireUser(role?: User["role"]) {
  const u = await currentUser();
  if (!u) throw new AppError("Please sign in", 401);
  if (role && u.role !== role) throw new AppError("Forbidden", 403);
  return u;
}

// ------------------------------------------------------------- authorization
/** The ONLY way merchant routes reach a business: ownership is always checked here. */
export async function ownedBusiness(user: User): Promise<Business> {
  const b = db.businesses.find((x) => x.ownerId === user.id);
  if (!b) throw new AppError("No business on this account yet", 404);
  return b;
}
export async function ownedQueue(user: User, queueId: string): Promise<Queue> {
  const q = db.queues.find((x) => x.id === queueId);
  const b = q && db.businesses.find((x) => x.id === q.businessId);
  if (!q || !b || (b.ownerId !== user.id && user.role !== "admin")) throw new AppError("Queue not found", 404);
  return q;
}
export async function ownedTicket(user: User, ticketId: string): Promise<Ticket> {
  const t = db.tickets.find((x) => x.id === ticketId);
  const b = t && db.businesses.find((x) => x.id === t.businessId);
  if (!t || !b || (b.ownerId !== user.id && user.role !== "admin")) throw new AppError("Ticket not found", 404);
  return t;
}

// ------------------------------------------------------------- rate limiting
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new AppError("Too many requests, please slow down", 429);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";

// ------------------------------------------------------------- route helpers
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new AppError("Invalid JSON body");
  }
}

/** Wrap a handler so AppError becomes a clean JSON error and anything else a 500. */
export function handle<A extends unknown[]>(fn: (...a: A) => Promise<Response> | Response) {
  return async (...a: A) => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof AppError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Something went wrong" }, 500);
    }
  };
}

/**
 * Server-Sent Events: pushes `compute()` immediately and again whenever any queue data changes
 * (deduplicated, so clients only receive real changes). Throwing AppError sends {error} and closes.
 */
export function sse(req: Request, compute: () => unknown) {
  const enc = new TextEncoder();
  let last = "";
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const push = () => {
        if (closed) return;
        try {
          const data = JSON.stringify(compute());
          if (data !== last) {
            last = data;
            controller.enqueue(enc.encode(`data: ${data}\n\n`));
          }
        } catch (e) {
          const msg = e instanceof AppError ? e.message : "error";
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          cleanup();
        }
      };
      const hb = setInterval(() => !closed && controller.enqueue(enc.encode(": hb\n\n")), 15000);
      const tick = setInterval(push, 20000); // time-based changes such as opening hours
      cleanup = () => {
        if (closed) return;
        closed = true;
        bus.off("change", push);
        clearInterval(hb);
        clearInterval(tick);
        try { controller.close(); } catch { /* already closed */ }
      };
      bus.on("change", push);
      req.signal.addEventListener("abort", cleanup);
      controller.enqueue(enc.encode("retry: 2000\n\n"));
      push();
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
