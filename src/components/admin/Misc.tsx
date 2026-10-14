"use client";
import { useState } from "react";
import { Cover } from "../ui";
import { Badge, DataTable, Drawer, Field, Loading, PageHeader, ago, confirmBox, useAct, useAdminData, type Col } from "./kit";

// ------------------------------------------------------------------ reviews
interface Rev { id: string; business: string; rating: number; text: string; name: string; hidden?: boolean; createdAt: number }

export function Reviews() {
  const { data, reload } = useAdminData<{ rows: Rev[] }>("reviews");
  const act = useAct(reload);
  if (!data) return <Loading />;
  const cols: Col<Rev>[] = [
    { key: "business", label: "Business", sort: (r) => r.business, render: (r) => <span className="font-semibold">{r.business}</span> },
    { key: "rating", label: "Rating", sort: (r) => r.rating, render: (r) => <span className="text-amber-500">{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></span> },
    { key: "text", label: "Review", render: (r) => <div className="max-w-md"><p className="truncate">{r.text || <span className="text-muted">(no text)</span>}</p><p className="text-xs text-muted">{r.name} · {ago(r.createdAt)}</p></div> },
    { key: "hidden", label: "Visibility", render: (r) => <Badge tone={r.hidden ? "amber" : "green"}>{r.hidden ? "hidden" : "public"}</Badge> },
    { key: "act", label: "", render: (r) => (
      <div className="flex justify-end gap-1"><button className="btn btn-ghost btn-sm" onClick={() => act({ action: "review.toggle", id: r.id }, r.hidden ? "Review restored" : "Review hidden")}>{r.hidden ? "Unhide" : "Hide"}</button>
        <button className="btn btn-danger btn-sm" onClick={() => confirmBox("Delete this review permanently?") && act({ action: "review.delete", id: r.id }, "Review deleted")}>Delete</button></div>) },
  ];
  return <><PageHeader title="Reviews" sub="Moderate what customers say. Reviews only come from real completed visits." /><DataTable rows={data.rows} cols={cols} searchText={(r) => `${r.business} ${r.text} ${r.name}`} pageSize={12} /></>;
}

// ------------------------------------------------------------------ categories
interface Cat { id: string; name: string; icon: string; imageUrl?: string; keywords: string[]; businesses: number }

export function Categories() {
  const { data, reload } = useAdminData<{ rows: Cat[] }>("categories", "", 0);
  const act = useAct(reload);
  const [edit, setEdit] = useState<Partial<Cat> | null>(null);
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader title="Categories" sub="Database-driven: add a category here and it is instantly available to every business and search." actions={<button className="btn btn-dark btn-sm" onClick={() => setEdit({ name: "", icon: "", keywords: [], imageUrl: "" })}>+ New category</button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.rows.map((c) => (
          <article key={c.id} className="card overflow-hidden">
            <Cover hue={220} icon={c.icon} imageUrl={c.imageUrl} w={500} className="h-28" />
            <div className="p-4">
              <div className="flex items-center justify-between"><h3 className="font-bold">{c.icon} {c.name}</h3><Badge>{c.businesses} {c.businesses === 1 ? "business" : "businesses"}</Badge></div>
              <p className="mt-1 truncate text-xs text-muted">{c.keywords.join(", ") || "no keywords"}</p>
              <div className="mt-3 flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => setEdit(c)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => confirmBox(`Delete category ${c.name}?`) && act({ action: "category.delete", id: c.id }, "Category deleted")}>Delete</button></div>
            </div>
          </article>
        ))}
      </div>
      {edit && <CatForm initial={edit} onClose={() => setEdit(null)} act={act} />}
    </>
  );
}

function CatForm({ initial, onClose, act }: { initial: Partial<Cat>; onClose: () => void; act: (p: Record<string, unknown>, ok?: string) => Promise<boolean> }) {
  const [f, setF] = useState({ name: initial.name ?? "", icon: initial.icon ?? "", imageUrl: initial.imageUrl ?? "", keywords: (initial.keywords ?? []).join(", ") });
  return (
    <Drawer open onClose={onClose} title={initial.id ? `Edit ${initial.name}` : "New category"}>
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); if (await act({ action: "category.save", id: initial.id, ...f }, "Category saved")) onClose(); }}>
        <Cover hue={220} icon={f.icon || "🏷"} imageUrl={f.imageUrl} w={600} className="h-40 rounded-2xl" />
        <Field label="Name"><input required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Icon (emoji)"><input className="input" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} /></Field>
        <Field label="Photo URL" hint="Direct https:// image link, used as the default cover for businesses in this category."><input className="input" value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} /></Field>
        <Field label="Search keywords" hint="Comma separated, e.g. “hair, haircut, styling”. Customers searching these words find this category."><input className="input" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} /></Field>
        <button className="btn btn-primary w-full">Save category</button>
      </form>
    </Drawer>
  );
}

// ------------------------------------------------------------------ audit
interface Entry { id: string; at: number; actor: string; action: string; target: string; detail?: string }

export function Audit() {
  const { data } = useAdminData<{ rows: Entry[] }>("audit", "", 8000);
  if (!data) return <Loading />;
  const cols: Col<Entry>[] = [
    { key: "at", label: "When", sort: (r) => r.at, render: (r) => <span title={new Date(r.at).toLocaleString()}>{ago(r.at)}</span> },
    { key: "actor", label: "Actor", sort: (r) => r.actor },
    { key: "action", label: "Action", render: (r) => <Badge tone="blue">{r.action}</Badge> },
    { key: "target", label: "Target", render: (r) => <span className="font-medium">{r.target}</span> },
    { key: "detail", label: "Detail", render: (r) => <span className="text-muted">{r.detail ?? ""}</span> },
  ];
  return <><PageHeader title="Audit log" sub="Every administrative change, with who did it and when." /><DataTable rows={data.rows} cols={cols} searchText={(r) => `${r.actor} ${r.action} ${r.target} ${r.detail ?? ""}`} pageSize={15} empty="No admin activity recorded yet." /></>;
}
