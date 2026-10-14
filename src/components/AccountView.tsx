"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BusinessCard, TicketView } from "@/lib/types";
import { post } from "@/lib/client";
import BusinessCardView from "./BusinessCardView";
import { Avatar, EmptyState, Skeleton } from "./ui";

interface Data {
  user: { email: string; name: string | null; picture: string | null; role: string; since: number } | null;
  favorites: BusinessCard[]; favoriteSlugs: string[]; tickets: TicketView[];
}

const STATUS: Record<string, string> = { WAITING: "Waiting", CALLED: "Called", SERVING: "Being served", COMPLETED: "Completed", SKIPPED: "Skipped", CANCELLED: "Left queue" };

export default function AccountView() {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  const load = () => fetch("/api/account").then((r) => r.json()).then((j: Data) => {
    if (!j.user) return router.replace("/login?next=/account");
    setD(j); setName(j.user.name ?? "");
  });
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d?.user) return <div className="mx-auto max-w-4xl space-y-4 px-4 py-8"><Skeleton className="h-28" /><Skeleton className="h-48" /></div>;
  const active = d.tickets.filter((t) => ["WAITING", "CALLED", "SERVING"].includes(t.status));
  const past = d.tickets.filter((t) => !active.includes(t));

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <section className="card flex flex-wrap items-center gap-5 p-6">
        <Avatar name={d.user.name ?? d.user.email} picture={d.user.picture} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{d.user.name ?? d.user.email.split("@")[0]}</h1>
          <p className="truncate text-sm text-muted">{d.user.email} · member since {new Date(d.user.since).toLocaleDateString()}</p>
        </div>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await post("/api/account", { action: "updateProfile", name }); setSaved(true); setTimeout(() => setSaved(false), 1500); load(); }}>
          <input className="input !w-48" aria-label="Display name" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-ghost">{saved ? "✓ Saved" : "Save"}</button>
        </form>
      </section>

      <section id="tickets">
        <h2 className="mb-3 text-xl font-bold">My tickets</h2>
        {d.tickets.length === 0 ? (
          <EmptyState icon="🎟" title="No tickets yet" hint="When you join a queue while signed in, it shows up here." action={<Link href="/search" className="btn btn-primary">Find a shorter wait</Link>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...active, ...past].map((t) => (
              <Link key={t.token} href={`/t/${t.token}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="w-16 text-center text-3xl font-black tabular-nums">{t.number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{t.business.name}</p>
                  <p className="truncate text-sm text-muted">{t.queue.name} · {new Date(t.joinedAt).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${active.includes(t) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {active.includes(t) && t.status === "WAITING" ? `${t.ahead} ahead` : STATUS[t.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Saved businesses</h2>
        {d.favorites.length === 0 ? (
          <EmptyState icon="🤍" title="Nothing saved yet" hint="Tap the heart on any business to keep it here." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.favorites.map((b) => <BusinessCardView key={b.slug} b={b} fav onFav={async (slug) => { await post("/api/account", { action: "toggleFavorite", slug }); load(); }} />)}
          </div>
        )}
      </section>
    </div>
  );
}
