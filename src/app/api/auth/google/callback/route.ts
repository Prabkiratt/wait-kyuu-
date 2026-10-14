import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db, notify, uid } from "@/lib/store";
import { startSession } from "@/lib/server";
import { adminEmails, googleConfigured, redirectUri, safeNext } from "@/lib/google";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** Step 2: Google redirects back with ?code. Exchange it, read the verified profile, sign the user in. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  let saved: { state: string; role: "customer" | "merchant"; next: string } | null = null;
  try { saved = JSON.parse(jar.get("vq_oauth")?.value ?? ""); } catch { /* missing or tampered */ }
  jar.delete("vq_oauth");
  const back = saved?.role === "merchant" ? "/merchant/login" : "/login";
  const fail = (code: string) => Response.redirect(new URL(`${back}?error=${code}`, url.origin), 302);

  if (!googleConfigured()) return fail("google_not_configured");
  const code = url.searchParams.get("code");
  const a = Buffer.from(url.searchParams.get("state") ?? "");
  const b = Buffer.from(saved?.state ?? "");
  if (url.searchParams.get("error") || !code || !saved || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail("google_denied");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(url.origin), grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("google_failed");
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const info = (await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } })).json()) as
      { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (!info.sub || !info.email || !info.email_verified) return fail("google_unverified");

    const email = info.email.toLowerCase();
    let user = db.users.find((u) => u.googleId === info.sub) ?? db.users.find((u) => u.email === email);
    const wantsAdmin = adminEmails().includes(email);
    if (!user) {
      if (!db.settings.allowSignups) return fail("signups_disabled");
      user = { id: uid(), email, role: wantsAdmin ? "admin" : saved.role, createdAt: Date.now(), status: "active", favorites: [] };
      db.users.push(user);
    }
    if (user.status === "suspended") return fail("suspended");
    user.googleId = info.sub;
    user.name = info.name ?? user.name;
    user.picture = info.picture ?? user.picture;
    user.lastLoginAt = Date.now();
    if (wantsAdmin && user.role !== "admin") {
      user.role = "admin";
      audit("system", "admin.promote", email, "ADMIN_EMAILS allowlist");
    }
    if (user.role === "admin") audit(email, "admin.login", email, "google");
    notify();
    await startSession(user.id);

    const dest = user.role === "admin" ? "/admin" : user.role === "merchant" ? "/merchant" : safeNext(saved.next) ?? "/account";
    return Response.redirect(new URL(dest, url.origin), 302);
  } catch (e) {
    console.error("google oauth", e);
    return fail("google_failed");
  }
}
