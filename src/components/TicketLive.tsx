"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { TicketView } from "@/lib/types";
import { forgetTicket, post, useLive } from "@/lib/client";
import { ErrorState, LiveTag, Skeleton } from "./ui";

export default function TicketLive({ token }: { token: string }) {
  const { data: t, error, connected } = useLive<TicketView>(`/api/ticket/${encodeURIComponent(token)}/stream`);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const prev = useRef<string>("");

  // Tab title + a buzz when it's almost your turn
  useEffect(() => {
    if (!t) return;
    const state = `${t.status}:${t.ahead}`;
    document.title = t.status === "WAITING" ? `${t.number} · ${t.ahead} ahead` : t.status === "SERVING" ? `${t.number} · Your turn!` : "Your ticket";
    if (prev.current && prev.current !== state && (t.status === "SERVING" || t.isNext)) navigator.vibrate?.([200, 100, 200]);
    prev.current = state;
  }, [t]);

  if (error) return <div className="px-4 py-16"><ErrorState message={error.message === "Ticket not found" ? "This ticket link isn't valid." : error.message} action={<Link className="btn btn-primary" href="/">Back to marketplace</Link>} /></div>;
  if (!t) return <div className="mx-auto max-w-md space-y-4 px-4 py-8"><Skeleton className="h-64" /><Skeleton className="h-24" /></div>;

  const active = t.status === "WAITING" || t.status === "CALLED" || t.status === "SERVING";
  const serving = t.status === "SERVING" || t.status === "CALLED";
  const banner =
    serving ? { text: "It's your turn!", sub: "Please head to the counter now.", cls: "bg-emerald-600 text-white" } :
    t.isNext ? { text: "You're next!", sub: "Start making your way over.", cls: "bg-amber-500 text-white" } : null;

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/business/${t.business.slug}`} className="font-semibold text-chili">← {t.business.name}</Link>
        <LiveTag connected={connected} />
      </div>

      <div className="card overflow-hidden">
        {banner && active && <div className={`pop px-5 py-4 text-center ${banner.cls}`}><div className="text-2xl font-extrabold">{banner.text}</div><div className="text-sm opacity-90">{banner.sub}</div></div>}
        <div className="p-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">Your ticket</p>
          <div key={t.number} className="pop my-2 text-7xl font-black tracking-tight tabular-nums">{t.number}</div>
          <p className="text-muted">{t.name} · {t.queue.name}</p>

          {active ? (
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Cell label="Now serving" value={t.queue.serving ?? "-"} />
              <Cell label={t.ahead === 1 ? "Person ahead" : "People ahead"} value={serving ? "0" : String(t.ahead)} />
              <Cell label="Est. wait" value={serving ? "Now" : `${t.estWaitMin} min`} />
            </div>
          ) : (
            <p className="mt-6 rounded-xl bg-[#f3eee3] p-4 font-semibold">
              {t.status === "COMPLETED" ? "✅ You've been served. Thanks for visiting!" : t.status === "SKIPPED" ? "⏭ Your turn was skipped. Please speak to the business to rejoin." : "You left the queue."}
            </p>
          )}
          {active && t.queue.status === "paused" && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">🔴 The queue is paused. Your place is saved.</p>}
        </div>
        <div className="border-t border-black/5 p-4 text-sm text-muted">
          {active ? "You can leave the venue. This page updates by itself, no refresh needed. Keep the link to come back." : "This ticket is closed."}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a className="btn btn-ghost flex-1" href={`tel:${t.business.phone.replace(/\s/g, "")}`}>📞 Call</a>
        <button className="btn btn-ghost flex-1" onClick={() => { navigator.clipboard?.writeText(location.href); setMsg("Ticket link copied"); setTimeout(() => setMsg(""), 1800); }}>🔗 Copy my link</button>
        {active && (
          <button
            className="btn btn-danger flex-1" disabled={busy}
            onClick={async () => {
              if (!confirm("Leave the queue? You'll lose your place.")) return;
              setBusy(true);
              try { await post(`/api/ticket/${encodeURIComponent(token)}`, { action: "leave" }); forgetTicket(t.business.slug); } catch (e) { setMsg((e as Error).message); }
              setBusy(false);
            }}
          >Leave queue</button>
        )}
      </div>
      {msg && <p role="status" className="mt-2 text-center text-sm text-muted">{msg}</p>}

      {t.canReview && (
        <form className="card mt-4 p-5" onSubmit={async (e) => {
          e.preventDefault();
          try { await post(`/api/ticket/${encodeURIComponent(token)}`, { action: "review", rating, text }); } catch (x) { setMsg((x as Error).message); }
        }}>
          <h2 className="font-bold">How was {t.business.name}?</h2>
          <div className="my-2 flex gap-1 text-3xl" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)} className={n <= rating ? "text-amber-500" : "text-slate-300"}>★</button>
            ))}
          </div>
          <textarea className="input" rows={2} maxLength={500} placeholder="Optional: tell others about it" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary mt-3 w-full" disabled={!rating}>Submit review</button>
        </form>
      )}
      {t.reviewed && <p className="mt-4 text-center text-sm text-muted">Thanks for your review ⭐</p>}
    </div>
  );
}

const Cell = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-[#f3eee3] p-3">
    <div key={value} className="pop text-2xl font-extrabold tabular-nums">{value}</div>
    <div className="mt-0.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted">{label}</div>
  </div>
);
