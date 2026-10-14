"use client";
import Link from "next/link";
import { Badge, Loading, PageHeader, Panel, ago, useAct, useAdminData } from "./kit";

interface D {
  kpis: Record<string, number | null>;
  trend: { day: string; joined: number; served: number; signups: number }[];
  top: { name: string; tickets: number }[];
  categories: { name: string; businesses: number }[];
  pending: { id: string; name: string; category: string }[];
  audit: { id: string; at: number; actor: string; action: string; target: string; detail?: string }[];
}

function LineChart({ data }: { data: D["trend"] }) {
  const w = 640, h = 200, pad = 28;
  const max = Math.max(5, ...data.flatMap((d) => [d.joined, d.served]));
  const x = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const path = (k: "joined" | "served") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Tickets joined and served over the last 14 days">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={pad} x2={w - pad} y1={y(max * t)} y2={y(max * t)} stroke="#eceef5" /><text x={pad - 6} y={y(max * t) + 4} fontSize="10" textAnchor="end" fill="#6b6b80">{Math.round(max * t)}</text></g>)}
      <path d={`${path("joined")} L${x(data.length - 1)},${h - pad} L${x(0)},${h - pad} Z`} fill="#1a1a17" opacity="0.08" />
      <path d={path("joined")} fill="none" stroke="#1a1a17" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={path("served")} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (i % 2 === 0 ? <text key={d.day} x={x(i)} y={h - 8} fontSize="10" textAnchor="middle" fill="#6b6b80">{d.day.slice(3)}</text> : null))}
    </svg>
  );
}

const Bars = ({ rows, color }: { rows: { name: string; v: number }[]; color: string }) => {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name}><div className="mb-1 flex justify-between text-sm"><span className="truncate font-medium">{r.name}</span><span className="tabular-nums text-muted">{r.v}</span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(r.v / max) * 100}%`, background: color }} /></div></li>
      ))}
    </ul>
  );
};

function Kpi({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const inner = <><p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p><p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>{sub && <p className="mt-1 text-xs text-muted">{sub}</p>}</>;
  return href ? <Link href={href} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">{inner}</Link> : <div className="card p-5">{inner}</div>;
}

export default function Overview() {
  const { data, error, reload } = useAdminData<D>("overview", "", 5000);
  const act = useAct(reload);
  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!data) return <Loading />;
  const k = data.kpis;
  return (
    <>
      <PageHeader title="Overview" sub="Everything happening across the platform, live." actions={<a className="btn btn-ghost btn-sm" href="/api/admin/export?type=businesses">⬇ Export businesses</a>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Businesses" value={k.businesses!} sub={`${k.approved} live · ${k.pending} pending · ${k.suspended} suspended`} href="/admin/businesses" />
        <Kpi label="People in line now" value={k.activeTickets!} sub={`${k.liveQueues} of ${k.queues} queues open`} href="/admin/queues" />
        <Kpi label="Tickets (24h)" value={k.ticketsToday!} sub={`${k.ticketsTotal} all-time`} href="/admin/tickets" />
        <Kpi label="Customers / merchants" value={`${k.customers} / ${k.merchants}`} sub="registered accounts" href="/admin/users" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Queue activity · 14 days" className="lg:col-span-2" actions={<span className="flex gap-3 text-xs font-semibold"><span className="text-chili">● Joined</span><span className="text-emerald-600">● Served</span></span>}><LineChart data={data.trend} /></Panel>
        <Panel title="Needs attention">
          {data.pending.length === 0 ? <p className="py-6 text-center text-sm text-muted">✅ No businesses awaiting approval.</p> : (
            <ul className="space-y-2">{data.pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{p.name}</p><p className="text-xs text-muted">{p.category}</p></div>
                <button className="btn btn-dark btn-sm" onClick={() => act({ action: "business.approve", id: p.id }, "Approved")}>Approve</button></li>
            ))}</ul>
          )}
          <p className="mt-4 text-xs text-muted">Platform rating: <b>{k.avgRating ?? "n/a"}</b> across {k.reviews} reviews</p>
        </Panel>
        <Panel title="Busiest businesses · 14 days"><Bars color="#1a1a17" rows={data.top.map((t) => ({ name: t.name, v: t.tickets }))} /></Panel>
        <Panel title="Businesses by category"><Bars color="#10b981" rows={data.categories.map((c) => ({ name: c.name, v: c.businesses }))} /></Panel>
        <Panel title="Recent admin activity" actions={<Link href="/admin/audit" className="text-xs font-semibold text-chili">View all</Link>}>
          <ul className="space-y-3 text-sm">{data.audit.map((a) => <li key={a.id}><div className="flex items-center justify-between gap-2"><Badge tone="blue">{a.action}</Badge><span className="text-xs text-muted">{ago(a.at)}</span></div><p className="mt-1 truncate text-xs text-muted">{a.actor} → {a.target}</p></li>)}
            {data.audit.length === 0 && <li className="py-4 text-center text-muted">No activity yet.</li>}</ul>
        </Panel>
      </div>
    </>
  );
}
