import { Hono } from "hono";
import { runWithRequest, withCookies } from "./lib/request-context";

import * as auth from "./routes/auth";
import * as authGoogle from "./routes/auth-google";
import * as authGoogleCallback from "./routes/auth-google-callback";
import * as marketStream from "./routes/market-stream";
import * as businessStream from "./routes/business-stream";
import * as businessJoin from "./routes/business-join";
import * as ticketStream from "./routes/ticket-stream";
import * as ticket from "./routes/ticket";
import * as merchantStream from "./routes/merchant-stream";
import * as merchantAction from "./routes/merchant-action";
import * as merchantOnboard from "./routes/merchant-onboard";
import * as qr from "./routes/qr";
import * as admin from "./routes/admin";
import * as adminExport from "./routes/admin-export";
import * as account from "./routes/account";
import * as pub from "./routes/public";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Response | Promise<Response>;
type Method = "get" | "post";

/** Origins allowed to call this API directly from a browser (the streams). Comma-separated in FRONTEND_URL. */
const allowedOrigins = () =>
  (process.env.FRONTEND_URL ?? process.env.APP_URL ?? "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);

export function buildApp(health: () => { ready: boolean; store: string }) {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const origin = c.req.header("origin");
    const allowed = allowedOrigins();
    const ok = origin && (allowed.includes(origin) || (process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin)));
    if (c.req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: ok ? { "Access-Control-Allow-Origin": origin!, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600", Vary: "Origin" } : {} });
    }
    await next();
    if (ok) {
      c.res.headers.set("Access-Control-Allow-Origin", origin!);
      c.res.headers.append("Vary", "Origin");
    }
  });

  app.get("/healthz", (c) => {
    const h = health();
    return c.json({ ok: h.ready, store: h.store }, h.ready ? 200 : 503);
  });
  app.get("/", (c) => c.json({ name: "wait-kyu-api", status: "ok" }));

  const route = (method: Method, path: string, h: Handler) => {
    app[method](path, async (c) => {
      const req = c.req.raw;
      const params = c.req.param() as Record<string, string>;
      return runWithRequest(req, async (ctx) => {
        const res = await h(req, { params: Promise.resolve(params) });
        return withCookies(res, ctx.setCookies);
      });
    });
  };

  route("get", "/api/auth", auth.GET as Handler);
  route("post", "/api/auth", auth.POST as Handler);
  route("get", "/api/auth/google", authGoogle.GET as Handler);
  route("get", "/api/auth/google/callback", authGoogleCallback.GET as Handler);
  route("get", "/api/public/bootstrap", pub.GET as Handler);
  route("get", "/api/market/stream", marketStream.GET as Handler);
  route("get", "/api/business/:slug/stream", businessStream.GET as Handler);
  route("post", "/api/business/:slug/join", businessJoin.POST as Handler);
  route("get", "/api/ticket/:token/stream", ticketStream.GET as Handler);
  route("post", "/api/ticket/:token", ticket.POST as Handler);
  route("get", "/api/merchant/stream", merchantStream.GET as Handler);
  route("post", "/api/merchant/stream-token", merchantStream.POST as Handler);
  route("post", "/api/merchant/action", merchantAction.POST as Handler);
  route("post", "/api/merchant/onboard", merchantOnboard.POST as Handler);
  route("get", "/api/qr/:slug", qr.GET as Handler);
  route("get", "/api/admin", admin.GET as Handler);
  route("post", "/api/admin", admin.POST as Handler);
  route("get", "/api/admin/export", adminExport.GET as Handler);
  route("get", "/api/account", account.GET as Handler);
  route("post", "/api/account", account.POST as Handler);

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((e, c) => {
    console.error("[api] unhandled:", e);
    return c.json({ error: "Something went wrong" }, 500);
  });
  return app;
}
