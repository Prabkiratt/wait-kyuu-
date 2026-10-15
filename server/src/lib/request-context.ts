import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context so handlers can read and set cookies without threading `req` everywhere.
 * (The route handlers were written against Web `Request`/`Response`; this keeps them unchanged.)
 */
interface Ctx { req: Request; setCookies: string[] }
const als = new AsyncLocalStorage<Ctx>();

export const runWithRequest = <T>(req: Request, fn: (ctx: Ctx) => T): T => {
  const ctx: Ctx = { req, setCookies: [] };
  return als.run(ctx, () => fn(ctx));
};

const store = () => {
  const c = als.getStore();
  if (!c) throw new Error("No request context");
  return c;
};

export function getCookie(name: string): string | undefined {
  const header = store().req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return undefined; }
    }
  }
  return undefined;
}

export interface CookieOpts { maxAgeSec?: number; httpOnly?: boolean; sameSite?: "Lax" | "Strict" | "None"; secure?: boolean; path?: string }

export function setCookie(name: string, value: string, o: CookieOpts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? "/"}`, `SameSite=${o.sameSite ?? "Lax"}`];
  if (o.httpOnly ?? true) parts.push("HttpOnly");
  if (o.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  if (o.maxAgeSec !== undefined) parts.push(`Max-Age=${Math.floor(o.maxAgeSec)}`);
  store().setCookies.push(parts.join("; "));
}

export const deleteCookie = (name: string) => setCookie(name, "", { maxAgeSec: 0 });

/** Attach any cookies queued during the request to the outgoing response. */
export function withCookies(res: Response, cookies: string[]): Response {
  if (!cookies.length) return res;
  const headers = new Headers(res.headers);
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * Where users actually are: the frontend origin (cookies and redirects must land there, not on the API host).
 * Set APP_URL (or FRONTEND_URL) in production. Falls back to the caller's Referer, then localhost in dev.
 */
export function publicOrigin(): string {
  const env = process.env.APP_URL ?? process.env.FRONTEND_URL;
  if (env) return env.split(",")[0].trim().replace(/\/$/, "");
  const ref = store().req.headers.get("referer") ?? store().req.headers.get("origin");
  if (ref) { try { return new URL(ref).origin; } catch { /* ignore */ } }
  return process.env.NODE_ENV === "production" ? new URL(store().req.url).origin : "http://localhost:3000";
}
