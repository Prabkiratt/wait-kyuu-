"use client";
import { useState } from "react";
import { Cover } from "../ui";
import { Badge, Drawer, Field, Loading, PageHeader, Panel, Switch, DataTable, approvalTone, confirmBox, useAct, useAdminData, type Col } from "./kit";

interface Row {
  id: string; slug: string; name: string; area: string; city: string; category: string; approval: string; liveQueue: boolean; status: string;
  owner: string; rating: number | null; reviews: number; tickets14d: number; queues: number; imageUrl: string | null; createdAt: number;
}
interface List { categories: { id: string; name: string }[]; rows: Row[] }
interface Detail {
  business: { id: string; slug: string; name: string; categoryId: string; description: string; phone: string; address: string; area: string; city: string; lat: number; lng: number; imageUrl?: string; gallery: string[]; hours: { open: string; close: string }; liveQueue: boolean; approval: string; hue: number };
  services: { id: string; name: string; durationMin: number; price?: number }[];
  queues: { id: string; name: string; avgServiceMin: number; maxSize?: number; status: string; view: { active: number } }[];
  owner?: string;
}

export default function Businesses() {
  const { data, reload } = useAdminData<List>("businesses");
  const act = useAct(reload);
  const [sel, setSel] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  if (!data) return <Loading />;

  const cols: Col<Row>[] = [
    { key: "name", label: "Business", sort: (r) => r.name.toLowerCase(), render: (r) => (
      <div className="flex items-center gap-3"><Cover hue={200} icon="🏪" imageUrl={r.imageUrl} w={120} className="h-10 w-14 shrink-0 rounded-lg" /><div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><p className="truncate text-xs text-muted">{r.area}, {r.city}</p></div></div>) },
    { key: "category", label: "Category", sort: (r) => r.category },
    { key: "approval", label: "Approval", sort: (r) => r.approval, render: (r) => <Badge tone={approvalTone(r.approval)}>{r.approval}</Badge> },
    { key: "status", label: "Live status", render: (r) => <Badge tone={r.status === "OPEN" ? "green" : r.status === "NO_LIVE_DATA" || r.status === "CLOSED" ? "gray" : "red"}>{r.status.replace("_", " ").toLowerCase()}</Badge> },
    { key: "rating", label: "Rating", sort: (r) => r.rating ?? 0, render: (r) => (r.rating ? `★ ${r.rating} (${r.reviews})` : "-") },
    { key: "tickets14d", label: "Tickets 14d", sort: (r) => r.tickets14d, className: "tabular-nums" },
    { key: "owner", label: "Owner", render: (r) => <span className="text-xs text-muted">{r.owner}</span> },
    { key: "act", label: "", render: (r) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {r.approval !== "approved" && <button className="btn btn-dark btn-sm" onClick={() => act({ action: "business.approve", id: r.id }, "Approved")}>Approve</button>}
        {r.approval === "approved" && <button className="btn btn-danger btn-sm" onClick={() => confirmBox(`Suspend ${r.name}? It will disappear from the marketplace.`) && act({ action: "business.suspend", id: r.id }, "Suspended")}>Suspend</button>}
      </div>) },
  ];

  return (
    <>
      <PageHeader title="Businesses" sub="Approve, edit and control every business on the platform." actions={<a className="btn btn-ghost btn-sm" href="/api/admin/export?type=businesses">⬇ Export CSV</a>} />
      <DataTable rows={data.rows.filter((r) => !status || r.approval === status)} cols={cols} onRow={(r) => setSel(r.id)}
        searchText={(r) => `${r.name} ${r.category} ${r.area} ${r.owner}`}
        filters={<select className="input !w-auto !py-2 !text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by approval"><option value="">All approvals</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select>} />
      {sel && <Editor id={sel} categories={data.categories} onClose={() => setSel(null)} onChanged={reload} />}
    </>
  );
}

function Editor({ id, categories, onClose, onChanged }: { id: string; categories: List["categories"]; onClose: () => void; onChanged: () => void }) {
  const { data, reload } = useAdminData<Detail>("business", `id=${id}`, 0);
  const done = () => { reload(); onChanged(); };
  const act = useAct(done);
  const [tab, setTab] = useState<"details" | "photos" | "services" | "queues" | "danger">("details");
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [svc, setSvc] = useState({ name: "", durationMin: "30", price: "" });
  const [nq, setNq] = useState({ name: "", avgServiceMin: "10" });

  if (data && !f) {
    const b = data.business;
    setF({ name: b.name, slug: b.slug, categoryId: b.categoryId, description: b.description, phone: b.phone, address: b.address, area: b.area, city: b.city, lat: String(b.lat), lng: String(b.lng), open: b.hours.open, close: b.hours.close, imageUrl: b.imageUrl ?? "", gallery: b.gallery.join("\n") });
  }
  const set = (k: string, v: string) => setF((p) => ({ ...p!, [k]: v }));
  const b = data?.business;

  return (
    <Drawer open onClose={onClose} wide title={b?.name ?? "Loading…"} sub={data ? `Owner: ${data.owner ?? "-"} · /business/${b?.slug}` : ""}>
      {!data || !f || !b ? <Loading /> : (
        <>
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist">
            {(["details", "photos", "services", "queues", "danger"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${tab === t ? "bg-white shadow-sm" : "text-muted"}`}>{t === "danger" ? "Status & delete" : t}</button>)}
          </div>

          {tab === "details" && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); act({ action: "business.update", id, fields: { ...f, lat: Number(f.lat), lng: Number(f.lng) } }, "Business updated"); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
                <Field label="Public URL slug" hint="/business/…"><input className="input" value={f.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
                <Field label="Category"><select className="input" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              </div>
              <Field label="Description"><textarea rows={3} className="input" value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
              <Field label="Address"><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Area"><input className="input" value={f.area} onChange={(e) => set("area", e.target.value)} /></Field>
                <Field label="City"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
                <Field label="Latitude"><input className="input" value={f.lat} onChange={(e) => set("lat", e.target.value)} /></Field>
                <Field label="Longitude"><input className="input" value={f.lng} onChange={(e) => set("lng", e.target.value)} /></Field>
                <Field label="Opens"><input type="time" className="input" value={f.open} onChange={(e) => set("open", e.target.value)} /></Field>
                <Field label="Closes"><input type="time" className="input" value={f.close} onChange={(e) => set("close", e.target.value)} /></Field>
              </div>
              <Switch checked={b.liveQueue} onChange={(v) => act({ action: "business.update", id, fields: { liveQueue: v } }, v ? "Live queue on" : "Live queue off")} label="Live queue enabled" hint="Off shows “Live queue unavailable” on the marketplace." />
              <button className="btn btn-primary w-full">Save changes</button>
            </form>
          )}

          {tab === "photos" && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); act({ action: "business.update", id, fields: { imageUrl: f.imageUrl, gallery: f.gallery } }, "Photos updated"); }}>
              <Cover hue={b.hue} icon="🏪" imageUrl={f.imageUrl} w={900} className="h-48 rounded-2xl" />
              <Field label="Cover photo URL" hint="Direct https:// link to an image. Leave empty to use the category photo."><input className="input" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" /></Field>
              <Field label="Gallery photo URLs" hint="One per line, up to 8."><textarea rows={4} className="input font-mono text-xs" value={f.gallery} onChange={(e) => set("gallery", e.target.value)} /></Field>
              <div className="grid grid-cols-4 gap-2">{f.gallery.split(/\s+/).filter(Boolean).slice(0, 8).map((u) => <Cover key={u} hue={b.hue} icon="🖼" imageUrl={u} w={300} className="h-20 rounded-lg" />)}</div>
              <button className="btn btn-primary w-full">Save photos</button>
            </form>
          )}

          {tab === "services" && (
            <div className="space-y-4">
              <ul className="divide-y divide-[#f0f1f6] rounded-xl border border-[#eceef5]">
                {data.services.map((s) => <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm"><span className="font-medium">{s.name} <span className="text-muted">· {s.durationMin} min{s.price !== undefined ? ` · ₹${s.price}` : ""}</span></span>
                  <button className="btn btn-danger btn-sm" onClick={() => confirmBox(`Delete ${s.name}?`) && act({ action: "service.delete", id: s.id }, "Service deleted")}>Delete</button></li>)}
                {data.services.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No services.</li>}
              </ul>
              <form className="flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: "service.save", businessId: id, ...svc }, "Service added")) setSvc({ name: "", durationMin: "30", price: "" }); }}>
                <input required className="input min-w-0 flex-1" placeholder="Service name" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} />
                <input className="input !w-20" aria-label="Minutes" value={svc.durationMin} onChange={(e) => setSvc({ ...svc, durationMin: e.target.value })} />
                <input className="input !w-24" placeholder="₹" aria-label="Price" value={svc.price} onChange={(e) => setSvc({ ...svc, price: e.target.value })} />
                <button className="btn btn-dark">Add</button>
              </form>
            </div>
          )}

          {tab === "queues" && (
            <div className="space-y-4">
              {data.queues.map((q) => <QueueRow key={q.id} q={q} act={act} />)}
              <form className="flex flex-wrap gap-2 border-t border-[#eceef5] pt-4" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: "queue.save", businessId: id, fields: { name: nq.name, avgServiceMin: Number(nq.avgServiceMin) } }, "Queue created")) setNq({ name: "", avgServiceMin: "10" }); }}>
                <input required className="input min-w-0 flex-1" placeholder="New queue name" value={nq.name} onChange={(e) => setNq({ ...nq, name: e.target.value })} />
                <input className="input !w-24" aria-label="Avg minutes" value={nq.avgServiceMin} onChange={(e) => setNq({ ...nq, avgServiceMin: e.target.value })} />
                <button className="btn btn-dark">Add queue</button>
              </form>
            </div>
          )}

          {tab === "danger" && (
            <div className="space-y-4">
              <Panel title="Approval status"><div className="flex items-center justify-between"><Badge tone={approvalTone(b.approval)}>{b.approval}</Badge>
                <div className="flex gap-2">{b.approval !== "approved" && <button className="btn btn-dark btn-sm" onClick={() => act({ action: "business.approve", id }, "Approved")}>Approve</button>}
                  {b.approval !== "suspended" && <button className="btn btn-danger btn-sm" onClick={() => act({ action: "business.suspend", id }, "Suspended")}>Suspend</button>}</div></div></Panel>
              <Panel title="Public page"><a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`/business/${b.slug}`}>Open public page ↗</a></Panel>
              <Panel title="Delete business"><p className="mb-3 text-sm text-muted">Permanently removes the business with its queues, tickets, services and reviews. This cannot be undone.</p>
                <button className="btn btn-danger" onClick={async () => { if (confirmBox(`Permanently delete ${b.name} and all its data?`) && (await act({ action: "business.delete", id }, "Business deleted"))) onClose(); }}>Delete business</button></Panel>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}

function QueueRow({ q, act }: { q: Detail["queues"][number]; act: (p: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  const [avg, setAvg] = useState(String(q.avgServiceMin));
  const [max, setMax] = useState(q.maxSize ? String(q.maxSize) : "");
  return (
    <div className="rounded-xl border border-[#eceef5] p-4">
      <div className="mb-3 flex items-center justify-between"><p className="font-bold">{q.name} <span className="text-sm font-normal text-muted">· {q.view.active} active</span></p><Badge tone={q.status === "open" ? "green" : "red"}>{q.status}</Badge></div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Avg min"><input className="input !w-24 !py-2" value={avg} onChange={(e) => setAvg(e.target.value)} /></Field>
        <Field label="Max waiting"><input className="input !w-28 !py-2" placeholder="no limit" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
        <button className="btn btn-dark btn-sm" onClick={() => act({ action: "queue.save", id: q.id, fields: { avgServiceMin: Number(avg), maxSize: max } }, "Queue updated")}>Save</button>
        <button className="btn btn-ghost btn-sm" onClick={() => act({ action: q.status === "open" ? "queue.pause" : "queue.resume", id: q.id }, q.status === "open" ? "Paused" : "Resumed")}>{q.status === "open" ? "Pause" : "Resume"}</button>
        <button className="btn btn-danger btn-sm" onClick={() => confirmBox(`Delete queue ${q.name} and its tickets?`) && act({ action: "queue.delete", id: q.id }, "Queue deleted")}>Delete</button>
      </div>
    </div>
  );
}
