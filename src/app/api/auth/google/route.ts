import crypto from "node:crypto";
import { cookies } from "next/headers";
import { googleConfigured, redirectUri, safeNext } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Step 1: send the browser to Google's consent screen. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role") === "merchant" ? "merchant" : "customer";
  const next = safeNext(url.searchParams.get("next")) ?? "";
  const back = role === "merchant" ? "/merchant/login" : "/login";
  if (!googleConfigured()) return Response.redirect(new URL(`${back}?error=google_not_configured`, url.origin), 302);

  const state = crypto.randomBytes(24).toString("base64url");
  (await cookies()).set("vq_oauth", JSON.stringify({ state, role, next }), {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production",
  });

  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(url.origin), response_type: "code",
    scope: "openid email profile", state, prompt: "select_account", access_type: "online",
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 302);
}
