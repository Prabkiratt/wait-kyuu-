"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BusinessCard, QueueView } from "@/lib/types";
import { getTicket, post, saveTicket, streamUrl, useFavorites, useLive } from "@/lib/client";
import { Cover, EmptyState, ErrorState, LiveTag, Skeleton, Stars, WaitBadge, photo } from "./ui";

interface Detail {
  card: BusinessCard;
  info: { description: string; phone: string; address: string; hours: { open: string; close: string }; category?: string; gallery: string[] };
  services: { id: string; name: string; durationMin: number; price?: number }[];
  queues: QueueView[];
  reviews: { id: string; rating: number; text: string; name: string; createdAt: number }[];
}

export default function BusinessView({ slug, autoJoin }: { slug: string; autoJoin: boolean }) {
  const { data, error, connected } = useLive<Detail>(streamUrl(`/api/business/${encodeURIComponent(slug)}/stream`));
  const router = useRouter();
  const { favs, toggle } = useFavorites();
  const [joining, setJoining] = useState<string | null>(null); // queue id being joined
  const [existing, setExisting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setExisting(getTicket(slug)), [slug]);
  useEffect(() => { if (data) document.title = `${data.card.name} · live queue`; }, [data?.card.name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (autoJoin && data && joining === null) {
      const open = data.queues.filter((q) => q.status === "open");
      if (open.length === 1) setJoining(open[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, !!data]);

  if (error) return <div className="px-4 py-16"><ErrorState message={error.message === "Business not found" ? "We couldn't find that business." : error.message} action={<Link className="btn btn-primary" href="/search">Browse businesses</Link>} /></div>;
  if (!data) return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6"><Skeleton className="h-44" /><Skeleton className="h-40" /><Skeleton className="h-60" /></div>
  );

  const { card, info, services, queues, reviews } = data;
  const canJoin = card.status === "OPEN" || card.status === "QUEUE_FULL" || card.status === "PAUSED";
  const share = async () => {
    const url = location.href.split("?")[0];
    if (navigator.share) { try { await navigator.share({ title: card.name, url }); return; } catch { /* cancelled */ } }
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const joinQ = queues.find((q) => q.id === joining);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16">
      <Gallery images={info.gallery} hue={card.hue} icon={card.category.icon} name={card.name} />
      <div className="-mt-10 px-3 sm:px-6">
        <div className="card relative p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{card.name}</h1>
              <p className="mt-1 text-muted">{info.category} · {card.area}, {card.city}</p>
              <div className="mt-2"><Stars rating={card.rating} count={card.reviewCount} /></div>
            </div>
            <button onClick={() => toggle(slug)} aria-pressed={favs.includes(slug)} aria-label="Save to favourites" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/15 text-chili hover:bg-[#f3eee3]"><svg width="20" height="20" viewBox="0 0 24 24" fill={favs.includes(slug) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.7 3 5.5 6.3 5.5c2 0 3.7 1.1 4.7 2.7h2c1-1.6 2.7-2.7 4.7-2.7 3.3 0 5.1 3.2 3.8 6.3C19.5 16.4 12 21 12 21Z" /></svg></button>
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{info.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn btn-ghost !py-2 text-sm" href={`tel:${info.phone.replace(/\s/g, "")}`}>Call business</a>
            <a className="btn btn-ghost !py-2 text-sm" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${card.lat}&mlon=${card.lng}#map=17/${card.lat}/${card.lng}`}>View on map</a>
            <button className="btn btn-ghost !py-2 text-sm" onClick={share}>{copied ? "✓ Link copied" : "Share"}</button>
          </div>
        </div>

        {/* LIVE QUEUE: the headline of the page */}
        <section className="card mt-4 p-5" aria-label="Live queue">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Live queue</h2>
            <LiveTag connected={connected} />
          </div>
          {card.status === "NO_LIVE_DATA" ? (
            <p className="mt-3 rounded-xl bg-slate-100 p-4 text-slate-600">⚪ Live queue unavailable. This business hasn&apos;t switched on live queue tracking, so we won&apos;t guess a wait time.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <WaitBadge status={card.status} waitMin={card.waitMin} tone={card.tone} size="lg" />
              {card.status === "CLOSED" && <p className="text-sm text-muted">Opens {info.hours.open}, closes {info.hours.close}.</p>}
              {existing && (
                <Link href={`/t/${existing}`} className="flex items-center justify-between rounded-xl bg-amber-50 p-3 font-semibold text-chili">
                  You already have a ticket here <span>View ticket →</span>
                </Link>
              )}
              {queues.map((q) => (
                <div key={q.id} className="rounded-2xl border border-[#ececf4] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {queues.length > 1 && <p className="font-bold">{q.name}</p>}
                      <p className="text-sm text-muted">{q.status === "paused" ? "Queue paused" : q.status === "full" ? "Queue full" : `${q.waiting} waiting · ~${q.avgServiceMin} min each`}</p>
                    </div>
                    <div className="grid w-full grid-cols-3 gap-2 text-center sm:w-auto sm:gap-5">
                      <Stat label="Now serving" value={q.serving ?? "-"} />
                      <Stat label="People waiting" value={String(q.waiting)} />
                      <Stat label="Est. wait" value={q.status === "open" ? `${q.estWaitMin} min` : "-"} />
                    </div>
                  </div>
                  <button
                    className="btn btn-primary mt-3 w-full" disabled={!canJoin || q.status !== "open" || card.status === "CLOSED"}
                    onClick={() => setJoining(q.id)}
                  >{q.status === "paused" ? "Queue paused" : q.status === "full" ? "Queue full" : card.status === "CLOSED" ? "Closed" : "Join queue"}</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Services</h2>
            {services.length === 0 ? <p className="text-sm text-muted">No services listed yet.</p> : (
              <ul className="divide-y divide-black/5">
                {services.map((s) => (
                  <li key={s.id} className="flex justify-between py-2.5"><span>{s.name} <span className="text-sm text-muted">· {s.durationMin} min</span></span><span className="font-semibold">{s.price !== undefined ? `₹${s.price}` : ""}</span></li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Details</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">Address</dt><dd>{info.address}</dd></div>
              <div><dt className="text-muted">Opening hours</dt><dd>{info.hours.open} – {info.hours.close}, daily</dd></div>
              <div><dt className="text-muted">Phone</dt><dd>{info.phone}</dd></div>
            </dl>
          </section>
        </div>

        <section className="card mt-4 p-5">
          <h2 className="mb-3 text-lg font-bold">Reviews</h2>
          {reviews.length === 0 ? (
            <EmptyState icon="⭐" title="No reviews yet" hint="Reviews come from customers who've been served here." />
          ) : (
            <ul className="space-y-4">
              {reviews.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center gap-2 text-sm"><span className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span><b>{r.name}</b><span className="text-muted">{new Date(r.createdAt).toLocaleDateString()}</span></div>
                  {r.text && <p className="mt-1 text-slate-700">{r.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {joinQ && (
        <JoinSheet
          bizName={card.name} queue={joinQ} onClose={() => setJoining(null)}
          onJoin={async (name, phone) => {
            const r = await post<{ token: string }>(`/api/business/${encodeURIComponent(slug)}/join`, { queueId: joinQ.id, name, phone });
            saveTicket(slug, r.token);
            router.push(`/t/${r.token}`);
          }}
        />
      )}
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0"><div className="whitespace-nowrap text-lg font-extrabold tabular-nums sm:text-xl">{value}</div><div className="text-[10px] uppercase leading-tight tracking-wide text-muted sm:text-[11px]">{label}</div></div>
);

function JoinSheet({ bizName, queue, onJoin, onClose }: { bizName: string; queue: QueueView; onJoin: (n: string, p: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <form
        className="pop card w-full max-w-md rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-b-3xl" onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr("");
          try { await onJoin(name, phone); } catch (x) { setErr((x as Error).message); setBusy(false); }
        }}
      >
        <h2 className="text-xl font-extrabold">Join the queue at {bizName}</h2>
        <p className="mt-1 text-sm text-muted">{queue.waiting} waiting · about {queue.estWaitMin} min. No account needed.</p>
        <label className="mt-4 block text-sm font-semibold">Your name
          <input autoFocus required maxLength={40} className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul" />
        </label>
        <label className="mt-3 block text-sm font-semibold">Phone <span className="font-normal text-muted">(optional, only the business sees it)</span>
          <input className="input mt-1" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
        </label>
        {err && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{err}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" disabled={busy || !name.trim()}>{busy ? "Joining…" : "Get my ticket"}</button>
        </div>
      </form>
    </div>
  );
}

function Gallery({ images, hue, icon, name }: { images: string[]; hue: number; icon: string; name: string }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const [main, ...rest] = images;
  return (
    <>
      <div className="mt-4 grid h-56 gap-2 overflow-hidden rounded-3xl sm:h-80 sm:grid-cols-3 sm:grid-rows-2">
        <button onClick={() => main && setZoom(main)} className={`group relative block text-left ${rest.length ? "sm:col-span-2 sm:row-span-2" : "sm:col-span-3 sm:row-span-2"}`} aria-label={`Open photo of ${name}`}>
          <Cover hue={hue} icon={icon} imageUrl={main} w={1200} eager className="h-full w-full" />
        </button>
        {rest.slice(0, 2).map((u, i) => (
          <button key={u} onClick={() => setZoom(u)} className="group relative hidden sm:block" aria-label={`Open photo ${i + 2} of ${name}`}>
            <Cover hue={hue} icon={icon} imageUrl={u} w={600} className="h-full w-full" />
          </button>
        ))}
      </div>
      {zoom && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setZoom(null)} role="dialog" aria-label="Photo viewer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(zoom, 1600)} alt={name} className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </>
  );
}
