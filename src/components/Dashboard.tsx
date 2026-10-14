"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { post, useLive } from "@/lib/client";
import { ErrorState, LiveTag, Skeleton } from "./ui";

interface Ticket { id: string; number: string; name: string; phone: string | null; status: string; source: string; joinedAt: number }
interface MQueue {
  id: string; name: string; status: "open" | "paused" | "full"; serving: string | null; waiting: number; active: number; avgServiceMin: number; estWaitMin: number;
  prefix: string; tickets: Ticket[]; recent: { id: string; number: string; name: string; status: string }[];
}
interface View {
  business: { slug: string; name: string; approval: string; liveQueue: boolean; description: string; phone: string; imageUrl: string | null };
  services: { id: string; name: string; durationMin: number; price?: number }[];
  queues: MQueue[]; status: string;
  stats: { customersToday: number; served: number; currentQueue: number; avgWaitMin: number; avgServiceMin: number; abandonmentPct: number; peak: number[]; trend: { day: string; served: number }[] };
}

export default function Dashboard() {
  const router = useRouter();
  const { data, error, connected } = useLive<View>("/api/merchant/stream");
  const [tab, setTab] = useState<"queue" | "qr" | "analytics" | "settings">("queue");
  const [qid, setQid] = useState<string>("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (error?.status === 401 || error?.message === "Please sign in") router.replace("/merchant/login");
    if (error?.message === "no-business") router.replace("/merchant/onboarding");
  }, [error, router]);

  if (error && !["Please sign in", "no-business"].includes(error.message)) return <div className="px-4 py-16"><ErrorState message={error.message} /></div>;
  if (!data) return <div className="mx-auto max-w-4xl space-y-4 px-4 py-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const q = data.queues.find((x) => x.id === qid) ?? data.queues[0];
  const act = async (payload: Record<string, unknown>) => {
    try { await post("/api/merchant/action", payload); } catch (e) { setToast((e as Error).message); setTimeout(() => setToast(""), 3000); }
  };
  const s = data.stats;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{data.business.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm"><LiveTag connected={connected} /><Link className="font-semibold text-chili" href={`/business/${data.business.slug}`}>Public page →</Link></div>
        </div>
        <button className="btn btn-ghost !py-2 text-sm" onClick={async () => { await post("/api/auth", { action: "logout" }); router.push("/merchant/login"); }}>Sign out</button>
      </div>
      {data.business.approval !== "approved" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">Your business is {data.business.approval}. It won&apos;t appear on the marketplace until approved.</p>}

      <div className="mt-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm" role="tablist">
        {(["queue", "qr", "analytics", "settings"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold capitalize ${tab === t ? "bg-brand text-white" : "text-muted"}`}>{t === "qr" ? "QR code" : t}</button>
        ))}
      </div>
      {toast && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{toast}</p>}

      {tab === "queue" && q && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Served today" value={s.served} /><Kpi label="Current queue" value={s.currentQueue} />
            <Kpi label="Avg wait" value={`${s.avgWaitMin} min`} /><Kpi label="Now serving" value={q.serving ?? "-"} />
          </div>

          {data.queues.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">{data.queues.map((x) => (
              <button key={x.id} onClick={() => setQid(x.id)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${x.id === q.id ? "border-brand bg-brand text-white" : "border-black/15 bg-white"}`}>{x.name} · {x.active}</button>
            ))}</div>
          )}

          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold">{q.name}</h2><p className="text-sm text-muted">{q.status === "paused" ? "🔴 Paused: customers can't join" : q.status === "full" ? "Full" : `🟢 Open · ${q.waiting} waiting · ~${q.avgServiceMin} min each`}</p></div>
              <button className="btn btn-ghost" onClick={() => act({ action: q.status === "paused" ? "resume" : "pause", queueId: q.id })}>{q.status === "paused" ? "▶ Resume queue" : "⏸ Pause queue"}</button>
            </div>
            <button
              className="btn btn-primary mt-4 w-full !py-5 text-xl" disabled={q.tickets.length === 0}
              onClick={() => act({ action: "next", queueId: q.id })}
            >NEXT CUSTOMER →</button>
            {q.tickets.length === 0 ? (
              <p className="mt-6 rounded-xl bg-[#f3eee3] p-6 text-center text-muted">Nobody in the queue. Customers who scan your QR code will appear here instantly. ✨</p>
            ) : (
              <ul className="mt-4 divide-y divide-black/5">
                {q.tickets.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="w-14 text-lg font-extrabold tabular-nums">{t.number}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.name}{t.source === "walk-in" && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">walk-in</span>}</p>
                      {t.phone && <p className="text-xs text-muted">{t.phone}</p>}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${t.status === "SERVING" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{t.status === "SERVING" ? "Serving" : "Waiting"}</span>
                    <button className="btn btn-ghost !px-3 !py-1.5 !text-sm" onClick={() => act({ action: "skip", ticketId: t.id })}>Skip</button>
                    <button className="btn btn-danger !px-3 !py-1.5 !text-sm" onClick={() => confirm(`Remove ${t.name}?`) && act({ action: "remove", ticketId: t.id })}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AddCustomer onAdd={(name, phone) => act({ action: "add", queueId: q.id, name, phone })} />
          {q.recent.length > 0 && <p className="text-center text-xs text-muted">Recently done: {q.recent.map((r) => `${r.number} (${r.status.toLowerCase()})`).join(" · ")}</p>}
        </div>
      )}

      {tab === "qr" && <QrTab slug={data.business.slug} name={data.business.name} />}
      {tab === "analytics" && <Analytics s={s} />}
      {tab === "settings" && <Settings data={data} act={act} />}
    </div>
  );
}

const Kpi = ({ label, value }: { label: string; value: string | number }) => (
  <div className="card p-4"><div className="text-2xl font-extrabold tabular-nums">{value}</div><div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div></div>
);

function AddCustomer({ onAdd }: { onAdd: (n: string, p: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  return (
    <form className="card flex flex-wrap gap-2 p-4" onSubmit={async (e) => { e.preventDefault(); await onAdd(name, phone); setName(""); setPhone(""); }}>
      <input required className="input min-w-0 flex-1" placeholder="Walk-in name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input !w-40" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <button className="btn btn-ghost">+ Add customer</button>
    </form>
  );
}

function QrTab({ slug, name }: { slug: string; name: string }) {
  const [url, setUrl] = useState("");
  const [full, setFull] = useState(false);
  useEffect(() => setUrl(`${location.origin}/join/${slug}`), [slug]);
  return (
    <div className="card mt-4 p-6 text-center">
      <div className="print-area">
        <h2 className="text-2xl font-extrabold">{name}</h2>
        <p className="text-muted">Scan to join the queue. No app, no signup.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/qr/${slug}`} alt={`QR code to join the queue at ${name}`} className="mx-auto my-4 h-64 w-64" />
        <p className="text-sm text-muted">{url}</p>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2 print:hidden">
        <a className="btn btn-primary" href={`/api/qr/${slug}`} download={`${slug}-qr.svg`}>⬇ Download</a>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print</button>
        <button className="btn btn-ghost" onClick={() => setFull(true)}>🖥 Display</button>
      </div>
      {full && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white" onClick={() => setFull(false)}>
          <div className="text-center"><h2 className="text-4xl font-extrabold">{name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr/${slug}`} alt="QR" className="mx-auto my-6 h-[min(70vw,60vh)] w-[min(70vw,60vh)]" /><p className="text-xl text-muted">Scan to join the queue · tap to close</p></div>
        </div>
      )}
    </div>
  );
}

function Analytics({ s }: { s: View["stats"] }) {
  const maxPeak = Math.max(1, ...s.peak), maxTrend = Math.max(1, ...s.trend.map((t) => t.served));
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Customers today" value={s.customersToday} /><Kpi label="Served" value={s.served} /><Kpi label="Avg service time" value={`${s.avgServiceMin} min`} /><Kpi label="Abandonment" value={`${s.abandonmentPct}%`} />
      </div>
      <div className="card p-5">
        <h2 className="font-bold">Peak hours <span className="text-sm font-normal text-muted">(last 14 days, arrivals by hour)</span></h2>
        <div className="mt-4 flex h-32 items-end gap-1" role="img" aria-label="Arrivals by hour of day">
          {s.peak.map((v, h) => <div key={h} title={`${h}:00 · ${v}`} className="flex-1 rounded-t bg-brand/80" style={{ height: `${(v / maxPeak) * 100}%`, minHeight: v ? 3 : 1 }} />)}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
      </div>
      <div className="card p-5">
        <h2 className="font-bold">Customers served <span className="text-sm font-normal text-muted">(daily, last 14 days)</span></h2>
        <div className="mt-4 flex h-32 items-end gap-1.5">
          {s.trend.map((t) => <div key={t.day} className="flex flex-1 flex-col items-center gap-1"><div title={`${t.day}: ${t.served}`} className="w-full rounded-t bg-emerald-500" style={{ height: `${(t.served / maxTrend) * 100}%`, minHeight: 2 }} /><span className="text-[9px] text-muted">{t.day.slice(3)}</span></div>)}
        </div>
      </div>
    </div>
  );
}

function Settings({ data, act }: { data: View; act: (p: Record<string, unknown>) => Promise<void> }) {
  const [svc, setSvc] = useState({ name: "", durationMin: "30", price: "" });
  const [nq, setNq] = useState({ name: "", avgServiceMin: "10" });
  const [pf, setPf] = useState({ description: data.business.description, phone: data.business.phone, imageUrl: data.business.imageUrl ?? "" });
  return (
    <div className="mt-4 space-y-4">
      <form className="card space-y-3 p-5" onSubmit={async (e) => { e.preventDefault(); await act({ action: "updateProfile", profile: pf }); }}>
        <h2 className="font-bold">Business profile</h2>
        <label className="block text-sm font-semibold">Description<textarea rows={2} className="input mt-1" value={pf.description} onChange={(e) => setPf({ ...pf, description: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Phone<input className="input mt-1" value={pf.phone} onChange={(e) => setPf({ ...pf, phone: e.target.value })} /></label>
          <label className="block text-sm font-semibold">Cover photo URL<input className="input mt-1" placeholder="https://…" value={pf.imageUrl} onChange={(e) => setPf({ ...pf, imageUrl: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary">Save profile</button>
      </form>
      <div className="card flex items-center justify-between gap-3 p-5">
        <div><h2 className="font-bold">Live queue on marketplace</h2><p className="text-sm text-muted">{data.business.liveQueue ? "Customers see your live wait and can join." : "Shown as “Live queue unavailable”."}</p></div>
        <button className="btn btn-ghost" onClick={() => act({ action: "toggleLive" })}>{data.business.liveQueue ? "Turn off" : "Turn on"}</button>
      </div>
      <div className="card p-5">
        <h2 className="font-bold">Services</h2>
        <ul className="my-2 divide-y divide-black/5 text-sm">{data.services.map((s) => <li key={s.id} className="flex justify-between py-2"><span>{s.name} · {s.durationMin} min</span><span>{s.price !== undefined ? `₹${s.price}` : ""}</span></li>)}</ul>
        <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); await act({ action: "addService", service: { name: svc.name, durationMin: Number(svc.durationMin), price: svc.price === "" ? undefined : Number(svc.price) } }); setSvc({ name: "", durationMin: "30", price: "" }); }}>
          <input required className="input min-w-0 flex-1" placeholder="New service" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} />
          <input className="input !w-20" aria-label="Minutes" value={svc.durationMin} onChange={(e) => setSvc({ ...svc, durationMin: e.target.value })} />
          <input className="input !w-24" placeholder="₹" aria-label="Price" value={svc.price} onChange={(e) => setSvc({ ...svc, price: e.target.value })} />
          <button className="btn btn-ghost">Add</button>
        </form>
      </div>
      <div className="card p-5">
        <h2 className="font-bold">Queues</h2>
        <ul className="my-2 divide-y divide-black/5 text-sm">{data.queues.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-2 py-2"><span>{q.name} <span className="text-muted">· prefix {q.prefix}</span></span>
            <label className="flex items-center gap-1 text-muted">avg min<input className="input !w-16 !py-1" defaultValue={q.avgServiceMin} onBlur={(e) => Number(e.target.value) !== q.avgServiceMin && act({ action: "setAvg", queueId: q.id, queue: { avgServiceMin: Number(e.target.value) } })} /></label></li>
        ))}</ul>
        <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); await act({ action: "addQueue", queue: { name: nq.name, avgServiceMin: Number(nq.avgServiceMin) } }); setNq({ name: "", avgServiceMin: "10" }); }}>
          <input required className="input min-w-0 flex-1" placeholder="New queue (e.g. Dr. Rao)" value={nq.name} onChange={(e) => setNq({ ...nq, name: e.target.value })} />
          <input className="input !w-20" aria-label="Avg minutes" value={nq.avgServiceMin} onChange={(e) => setNq({ ...nq, avgServiceMin: e.target.value })} />
          <button className="btn btn-ghost">Add queue</button>
        </form>
      </div>
    </div>
  );
}
