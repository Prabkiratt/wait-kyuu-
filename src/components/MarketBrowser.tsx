"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { BusinessCard } from "@/lib/types";
import { streamUrl, useDebounced, useFavorites, useLive, useLocation } from "@/lib/client";
import BusinessCardView from "./BusinessCardView";
import { EmptyState, ErrorState, LiveTag, Skeleton } from "./ui";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <Skeleton className="h-[480px] w-full" /> });

interface Feed {
  results: BusinessCard[];
  categories: { slug: string; name: string; icon: string }[];
  areas: { name: string; lat: number; lng: number }[];
  rankingNote: string;
}

export default function MarketBrowser({ initialQ = "", initialCat = "", search = false }: { initialQ?: string; initialCat?: string; search?: boolean }) {
  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState(initialCat);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [maxWait, setMaxWait] = useState("");
  const [minRating, setMinRating] = useState("");
  const [sort, setSort] = useState("relevance");
  const [view, setView] = useState<"list" | "map">("list");
  const { loc, setLoc, locate, locating, locError } = useLocation();
  const { favs, toggle } = useFavorites();
  const dq = useDebounced(q);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (dq.trim()) p.set("q", dq.trim());
    if (cat) p.set("cat", cat);
    if (open) p.set("open", "1");
    if (live) p.set("live", "1");
    if (maxWait) p.set("maxWait", maxWait);
    if (minRating) p.set("minRating", minRating);
    p.set("sort", sort);
    p.set("lat", String(loc.lat));
    p.set("lng", String(loc.lng));
    return streamUrl(`/api/market/stream?${p}`);
  }, [dq, cat, open, live, maxWait, minRating, sort, loc]);

  const { data, error, connected } = useLive<Feed>(url);
  useEffect(() => { // keep the address bar shareable
    const p = new URLSearchParams();
    if (dq.trim()) p.set("q", dq.trim());
    if (cat) p.set("cat", cat);
    if (search) history.replaceState(null, "", p.size ? `/search?${p}` : "/search");
  }, [dq, cat, search]);

  const clear = () => { setQ(""); setCat(""); setOpen(false); setLive(false); setMaxWait(""); setMinRating(""); };
  const results = data?.results ?? [];

  return (
    <section id="browse" className="mx-auto w-full max-w-6xl px-4">
      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-xl bg-[#f3eee3] px-3">
          <span aria-hidden>🔍</span>
          <input
            className="w-full bg-transparent py-3 outline-none" placeholder="What are you looking for? Salon, dentist, coffee…"
            value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search businesses, categories or services"
          />
          {q && <button onClick={() => setQ("")} aria-label="Clear search" className="text-muted">✕</button>}
        </label>
        <div className="flex items-center gap-2">
          <select
            aria-label="Location" className="input !w-auto !py-3" value={loc.label}
            onChange={(e) => {
              const a = data?.areas.find((x) => x.name === e.target.value);
              if (a) setLoc({ lat: a.lat, lng: a.lng, label: a.name });
            }}
          >
            <option value={loc.label}>{loc.label === "Near me" ? "📍 Near me" : `📍 ${loc.label}`}</option>
            {data?.areas.filter((a) => a.name !== loc.label).map((a) => <option key={a.name}>{a.name}</option>)}
          </select>
          <button onClick={locate} disabled={locating} className="btn btn-ghost !py-3 whitespace-nowrap">{locating ? "Locating…" : "Near me"}</button>
        </div>
      </div>
      {locError && <p role="alert" className="mt-2 text-sm text-red-600">{locError}</p>}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={!cat} onClick={() => setCat("")}>All</Chip>
        {data?.categories.map((c) => <Chip key={c.slug} active={cat === c.slug} onClick={() => setCat(cat === c.slug ? "" : c.slug)}>{c.name}</Chip>)}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <Toggle on={open} set={setOpen}>Open now</Toggle>
        <Toggle on={live} set={setLive}>Live queue available</Toggle>
        <select className="input !w-auto !py-2 !text-sm" value={maxWait} onChange={(e) => setMaxWait(e.target.value)} aria-label="Maximum wait">
          <option value="">Any wait</option><option value="10">≤ 10 min</option><option value="20">≤ 20 min</option><option value="30">≤ 30 min</option><option value="60">≤ 1 hour</option>
        </select>
        <select className="input !w-auto !py-2 !text-sm" value={minRating} onChange={(e) => setMinRating(e.target.value)} aria-label="Minimum rating">
          <option value="">Any rating</option><option value="4">4★ +</option><option value="4.5">4.5★ +</option>
        </select>
        <select className="input !w-auto !py-2 !text-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          <option value="relevance">Sort: Relevance</option><option value="wait">Sort: Shortest wait</option><option value="distance">Sort: Distance</option><option value="rating">Sort: Rating</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          <LiveTag connected={connected} />
          <div className="flex rounded-xl border border-black/15 bg-white p-0.5" role="tablist" aria-label="View">
            {(["list", "map"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 font-semibold capitalize ${view === v ? "bg-brand text-white" : ""}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 pb-12" aria-live="polite">
        {error ? (
          <ErrorState message={error.message} action={<button className="btn btn-primary" onClick={() => location.reload()}>Retry</button>} />
        ) : !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72" />)}</div>
        ) : results.length === 0 ? (
          <EmptyState icon="🔎" title="No businesses match" hint="Try a different word, widen the wait limit, or clear the filters." action={<button className="btn btn-primary" onClick={clear}>Clear filters</button>} />
        ) : view === "map" ? (
          <MapView items={results} center={loc} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((b) => <BusinessCardView key={b.slug} b={b} fav={favs.includes(b.slug)} onFav={toggle} />)}
          </div>
        )}
        {data && <p className="mt-4 text-center text-xs text-muted">{results.length} result{results.length === 1 ? "" : "s"} · {data.rankingNote}</p>}
      </div>
    </section>
  );
}

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} aria-pressed={active} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-brand bg-brand text-white" : "border-black/15 bg-white hover:bg-[#f3eee3]"}`}>{children}</button>
);
const Toggle = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode }) => (
  <button onClick={() => set(!on)} aria-pressed={on} className={`rounded-full border px-3 py-2 font-semibold ${on ? "border-brand bg-amber-50 text-chili" : "border-black/15 bg-white"}`}>{on ? "✓ " : ""}{children}</button>
);
