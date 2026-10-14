"use client";
import { useState } from "react";
import { Badge, DataTable, Drawer, Loading, PageHeader, ago, confirmBox, useAct, useAdminData, type Col } from "./kit";

interface Row { id: string; name: string; business: string; status: string; state: string; active: number; waiting: number; serving: string | null; avg: number; est: number; maxSize: number | null }
interface Detail {
  queue: { id: string; name: string; business: string; status: string; avg: number };
  view: { serving: string | null; waiting: number; active: number; estWaitMin: number };
  active: T[]; history: T[];
}
interface T { id: string; number: string; name: string; phone: string | null; status: string; source: string; joinedAt: number }

export default function Queues() {
  const { data, reload } = useAdminData<{ rows: Row[] }>("queues", "", 4000);
  const act = useAct(reload);
  const [sel, setSel] = useState<string | null>(null);
  if (!data) return <Loading />;

  const cols: Col<Row>[] = [
    { key: "business", label: "Business", sort: (r) => r.business, render: (r) => <span className="font-semibold">{r.business}</span> },
    { key: "name", label: "Queue", sort: (r) => r.name },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "paused" ? "red" : r.state === "full" ? "amber" : "green"}>{r.status === "paused" ? "paused" : r.state === "full" ? "full" : "open"}</Badge> },
    { key: "serving", label: "Serving", render: (r) => r.serving ?? "-", className: "font-mono" },
    { key: "active", label: "In line", sort: (r) => r.active, className: "tabular-nums" },
    { key: "est", label: "Est. wait", sort: (r) => r.est, render: (r) => `${r.est} min` },
    { key: "act", label: "", render: (r) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-dark btn-sm" disabled={r.active === 0} onClick={() => act({ action: "queue.next", id: r.id }, "Called next customer")}>Next</button>
        <button className="btn btn-ghost btn-sm" onClick={() => act({ action: r.status === "paused" ? "queue.resume" : "queue.pause", id: r.id }, r.status === "paused" ? "Resumed" : "Paused")}>{r.status === "paused" ? "Resume" : "Pause"}</button>
      </div>) },
  ];
  return (
    <>
      <PageHeader title="Live queues" sub="Every queue on the platform. Step in and operate any of them." />
      <DataTable rows={data.rows} cols={cols} onRow={(r) => setSel(r.id)} searchText={(r) => `${r.business} ${r.name}`} pageSize={12} />
      {sel && <Control id={sel} onClose={() => setSel(null)} onChanged={reload} />}
    </>
  );
}

function Control({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, reload } = useAdminData<Detail>("queue", `id=${id}`, 3000);
  const done = () => { reload(); onChanged(); };
  const act = useAct(done);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <Drawer open onClose={onClose} wide title={data ? `${data.queue.business} · ${data.queue.name}` : "Loading…"} sub={data ? `${data.view.active} in line · now serving ${data.view.serving ?? "nobody"} · est. ${data.view.estWaitMin} min` : ""}>
      {!data ? <Loading /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={data.active.length === 0} onClick={() => act({ action: "queue.next", id }, "Called next")}>NEXT CUSTOMER →</button>
            <button className="btn btn-ghost" onClick={() => act({ action: data.queue.status === "paused" ? "queue.resume" : "queue.pause", id }, "Updated")}>{data.queue.status === "paused" ? "▶ Resume" : "⏸ Pause"}</button>
            <button className="btn btn-danger" disabled={data.active.length === 0} onClick={() => confirmBox(`Cancel all ${data.active.length} active tickets?`) && act({ action: "queue.clear", id }, "Queue cleared")}>Clear queue</button>
          </div>
          <ul className="divide-y divide-[#f0f1f6] rounded-xl border border-[#eceef5]">
            {data.active.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-14 font-mono text-lg font-bold">{t.number}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{t.name}{t.source === "walk-in" && <span className="ml-2"><Badge>walk-in</Badge></span>}</p><p className="text-xs text-muted">{t.phone ?? "no phone"} · joined {ago(t.joinedAt)}</p></div>
                <Badge tone={t.status === "SERVING" ? "green" : "gray"}>{t.status === "SERVING" ? "serving" : "waiting"}</Badge>
                <button className="btn btn-ghost btn-sm" onClick={() => act({ action: "ticket.skip", id: t.id }, "Skipped")}>Skip</button>
                <button className="btn btn-danger btn-sm" onClick={() => act({ action: "ticket.remove", id: t.id }, "Removed")}>Remove</button>
              </li>
            ))}
            {data.active.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Nobody in this queue.</li>}
          </ul>
          <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: "ticket.add", queueId: id, name, phone }, "Customer added")) { setName(""); setPhone(""); } }}>
            <input required className="input min-w-0 flex-1" placeholder="Add walk-in customer" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input !w-40" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="btn btn-dark">Add</button>
          </form>
          <div><h3 className="mb-2 text-sm font-bold text-muted">RECENTLY FINISHED</h3>
            <ul className="space-y-1 text-sm">{data.history.slice(0, 10).map((t) => <li key={t.id} className="flex justify-between"><span><span className="font-mono">{t.number}</span> {t.name}</span><Badge tone={t.status === "COMPLETED" ? "green" : "gray"}>{t.status.toLowerCase()}</Badge></li>)}</ul></div>
        </div>
      )}
    </Drawer>
  );
}
