"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { post } from "@/lib/client";

// ------------------------------------------------------------------ data + actions
export function useAdminData<T>(view: string, params = "", every = 6000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin?view=${view}${params ? `&${params}` : ""}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Failed to load");
    setError(""); setData(j as T);
  }, [view, params]);
  useEffect(() => { load(); if (!every) return; const i = setInterval(load, every); return () => clearInterval(i); }, [load, every]);
  return { data, error, reload: load };
}

const ToastCtx = createContext<(msg: string, kind?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[80] space-y-2" aria-live="polite">
        {items.map((i) => <div key={i.id} role="status" className={`slide-in rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${i.kind === "error" ? "bg-red-600" : "bg-slate-900"}`}>{i.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/** Run an admin mutation with toast feedback. Resolves to true on success. */
export function useAct(onDone?: () => void) {
  const toast = useToast();
  return useCallback(async (payload: Record<string, unknown>, ok = "Saved") => {
    try { await post("/api/admin", payload); toast(ok); onDone?.(); return true; }
    catch (e) { toast((e as Error).message, "error"); return false; }
  }, [toast, onDone]);
}

// ------------------------------------------------------------------ small pieces
const BADGE: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200", amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200", gray: "bg-slate-100 text-slate-600 ring-slate-200", blue: "bg-amber-50 text-stone-900 ring-amber-200",
};
export const Badge = ({ tone = "gray", children }: { tone?: keyof typeof BADGE; children: React.ReactNode }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${BADGE[tone]}`}>{children}</span>
);

export const approvalTone = (a: string) => (a === "approved" ? "green" : a === "pending" ? "amber" : "red") as "green" | "amber" | "red";

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const Panel = ({ title, actions, children, className = "" }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <section className={`card p-5 ${className}`}>
    {(title || actions) && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">{title}</h2>{actions}</div>}
    {children}
  </section>
);

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold"><span className="mb-1 block">{label}</span>{children}{hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}</label>;
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div><p className="text-sm font-semibold">{label}</p>{hint && <p className="text-xs text-muted">{hint}</p>}</div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export function Drawer({ open, onClose, title, sub, children, wide }: { open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className={`slide-in flex h-full w-full flex-col bg-white shadow-2xl ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <header className="flex items-start justify-between gap-3 border-b border-[#eceef5] px-6 py-4">
          <div className="min-w-0"><h2 className="truncate text-lg font-extrabold">{title}</h2>{sub && <p className="truncate text-sm text-muted">{sub}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-xl text-muted hover:bg-slate-100">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </aside>
    </div>
  );
}

export const ago = (t?: number | null) => {
  if (!t) return "never";
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ------------------------------------------------------------------ table with search / sort / paging
export interface Col<T> { key: string; label: string; render?: (r: T) => React.ReactNode; sort?: (r: T) => string | number; className?: string }

export function DataTable<T extends { id: string }>({ rows, cols, searchText, filters, pageSize = 10, empty = "Nothing here yet.", onRow }: {
  rows: T[]; cols: Col<T>[]; searchText?: (r: T) => string; filters?: React.ReactNode; pageSize?: number; empty?: string; onRow?: (r: T) => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    let out = q && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(q.toLowerCase())) : rows;
    const c = sort && cols.find((x) => x.key === sort.key);
    if (c?.sort) out = [...out].sort((a, b) => { const x = c.sort!(a), y = c.sort!(b); return (x < y ? -1 : x > y ? 1 : 0) * sort!.dir; });
    return out;
  }, [rows, q, sort, cols, searchText]);
  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = view.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#eceef5] p-3">
        {searchText && <input className="input !w-64 !py-2 !text-sm" placeholder="Search…" aria-label="Search table" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />}
        {filters}
        <span className="ml-auto text-xs text-muted">{view.length} {view.length === 1 ? "result" : "results"}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#f8f9fc]"><tr>
            {cols.map((c) => (
              <th key={c.key} className={`th ${c.className ?? ""}`} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                {c.sort ? <button onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 })} className="uppercase hover:text-foreground">{c.label} {sort?.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}</button> : c.label}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {slice.map((r) => (
              <tr key={r.id} onClick={onRow ? () => onRow(r) : undefined} className={`border-t border-[#f0f1f6] ${onRow ? "cursor-pointer hover:bg-[#f8f9fc]" : ""}`}>
                {cols.map((c) => <td key={c.key} className={`td ${c.className ?? ""}`}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}</td>)}
              </tr>
            ))}
            {slice.length === 0 && <tr><td colSpan={cols.length} className="px-4 py-12 text-center text-sm text-muted">{q ? "No matches for your search." : empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-[#eceef5] p-3 text-sm">
          <span className="text-muted">Page {cur + 1} of {pages}</span>
          <div className="flex gap-2"><button className="btn btn-ghost btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</button><button className="btn btn-ghost btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button></div>
        </div>
      )}
    </div>
  );
}

export const Loading = () => <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-24" />)}</div>;
export const confirmBox = (msg: string) => typeof window !== "undefined" && window.confirm(msg);
