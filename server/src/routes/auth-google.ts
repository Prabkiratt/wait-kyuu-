import crypto from "node:crypto";
import { googleConfigured, redirectUri, safeNext } from "../lib/google";
import { publicOrigin, setCookie } from "../lib/request-context";

/** Step 1: send the browser to Google's consent screen. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = publicOrigin();
  const role = url.searchParams.get("role") === "merchant" ? "merchant" : "customer";
  const next = safeNext(url.searchParams.get("next")) ?? "";
  const back = role === "merchant" ? "/merchant/login" : "/login";
  if (!googleConfigured()) return Response.redirect(new URL(`${back}?error=google_not_configured`, origin), 302);

  const state = crypto.randomBytes(24).toString("base64url");
  setCookie("vq_oauth", JSON.stringify({ state, role, next }), { maxAgeSec: 600 });

  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(origin), response_type: "code",
    scope: "openid email profile", state, prompt: "select_account", access_type: "online",
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 302);
}
