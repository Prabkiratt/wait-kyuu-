"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/lib/client";

type Role = "customer" | "merchant" | "admin";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up on this server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see README), or use email below.",
  google_denied: "Google sign-in was cancelled or expired. Please try again.",
  google_failed: "We couldn't complete Google sign-in. Please try again.",
  google_unverified: "Your Google account's email isn't verified.",
  suspended: "This account has been suspended. Contact support.",
  signups_disabled: "New sign-ups are temporarily disabled.",
};

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/** One sign-in surface for customers, merchants and the platform admin. */
export default function AuthForm({ role, googleEnabled, next, error, demos = [] }: {
  role: Role; googleEnabled: boolean; next?: string; error?: string; demos?: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(error ? ERRORS[error] ?? "Sign-in failed. Please try again." : "");
  const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<{ role?: string }>) {
    setBusy(true); setErr("");
    try {
      const r = await fn();
      router.push(r.role === "admin" ? "/admin" : r.role === "merchant" ? "/merchant" : next || "/account");
      router.refresh();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const title = role === "admin" ? "Admin console" : role === "merchant" ? (mode === "login" ? "Welcome back" : "Create your business account") : mode === "login" ? "Sign in to your account" : "Create your account";
  const sub = role === "admin" ? "Restricted to platform administrators." : role === "merchant" ? "Run your queue, QR code and customers from one dashboard." : "Save favourites and keep track of your queue tickets.";
  const googleHref = `/api/auth/google?role=${role === "merchant" ? "merchant" : "customer"}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-8 px-4 py-10 lg:grid-cols-2">
      <div className="hidden lg:block">
        <div className="relative overflow-hidden rounded-3xl border-2 border-stone-900 bg-[#ffc21a] p-10 text-stone-900">
          <p className="text-sm font-semibold uppercase tracking-widest text-stone-700">Never wait blindly again</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight">{role === "merchant" ? "Turn your waiting room into a live, shareable queue." : "See the wait before you leave home."}</h2>
          <ul className="mt-6 space-y-3 text-stone-800">
            {(role === "merchant" ? ["One-tap NEXT CUSTOMER dashboard", "QR code customers scan, with no app", "Show up on the live marketplace"] : ["Live waiting times for nearby businesses", "Join queues remotely and track your spot", "Your tickets and favourites in one place"]).map((t) => <li key={t} className="flex gap-2"><span>✓</span>{t}</li>)}
          </ul>
        </div>
      </div>

      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{sub}</p>

        <a href={googleHref} className="btn btn-ghost mt-5 w-full !py-3"><GoogleLogo /> Continue with Google</a>
        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-[#e8e8f2]" />or with email<span className="h-px flex-1 bg-[#e8e8f2]" /></div>

        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(() => post("/api/auth", { action: mode, email, password, name, role })); }}>
          {mode === "register" && <label className="block text-sm font-semibold">Full name<input autoComplete="name" className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>}
          <label className="block text-sm font-semibold">Email<input required type="email" autoComplete="email" className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block text-sm font-semibold">Password<input required type="password" minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{err}</p>}
          <button className="btn btn-primary w-full !py-3" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        {!googleEnabled && <p className="mt-3 text-xs text-muted">Google sign-in is not configured on this server.</p>}

        {role !== "admin" && (
          <button className="mt-4 w-full text-sm font-semibold text-chili" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
            {mode === "login" ? "New here? Create an account" : "Already registered? Sign in"}
          </button>
        )}

        {demos.length > 0 && (
          <div className="mt-6 rounded-2xl bg-[#f6f6fb] p-4">
            <p className="text-sm font-bold">Demo mode <span className="font-normal text-muted">(local only)</span></p>
            <div className="mt-2 flex flex-wrap gap-2">
              {demos.map((d) => <button key={d.slug} disabled={busy} className="btn btn-ghost !px-3 !py-1.5 !text-sm" onClick={() => go(() => post("/api/auth", { action: "demo", demo: d.slug }))}>{d.name}</button>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
