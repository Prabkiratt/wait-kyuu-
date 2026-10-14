"use client";
import Link from "next/link";
import type { BusinessCard } from "@/lib/types";
import { useLive } from "@/lib/client";
import { Cover, LiveTag, Skeleton } from "./ui";

const COLOR = { green: "#14591d", amber: "#9a6500", red: "#b3300f", gray: "#55503f" } as const;

/** Real, live data: the five open queues with the shortest wait right now. */
export default function ShortestWaits() {
  const { data, connected } = useLive<{ results: BusinessCard[] }>("/api/market/stream?sort=wait&live=1&open=1");
  const rows = (data?.results ?? []).filter((b) => b.waitMin !== null && b.status === "OPEN").slice(0, 5);
  return (
    <div className="relative">
      <div className="card overflow-hidden border-2 border-stone-900 shadow-[6px_6px_0_#1a1a17]">
        <div className="flex items-center justify-between border-b-2 border-dashed border-stone-900/25 bg-[#ffc21a] px-5 py-3">
          <h2 className="display text-lg font-extrabold">Shortest waits right now</h2>
          <LiveTag connected={connected} />
        </div>
        <ul className="divide-y divide-black/10">
          {!data && Array.from({ length: 5 }, (_, i) => <li key={i} className="p-4"><Skeleton className="h-12" /></li>)}
          {rows.map((b, i) => (
            <li key={b.slug}>
              <Link href={`/business/${b.slug}`} className="group flex items-center gap-4 px-5 py-3 transition hover:bg-[#fffaf0]">
                <span className="display w-5 text-sm font-bold text-stone-400">{i + 1}</span>
                <Cover hue={b.hue} icon={b.category.name[0]} imageUrl={b.imageUrl} w={160} className="h-12 w-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold group-hover:underline">{b.name}</p>
                  <p className="truncate text-xs text-muted">{b.category.name} · {b.area}</p>
                </div>
                <div className="text-right">
                  <p className="display text-2xl font-extrabold leading-none tabular-nums" style={{ color: COLOR[b.tone] }}>{b.waitMin === 0 ? "Now" : b.waitMin}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{b.waitMin === 0 ? "no wait" : "min"}</p>
                </div>
              </Link>
            </li>
          ))}
          {data && rows.length === 0 && <li className="p-8 text-center text-sm text-muted">No live queues open right now.</li>}
        </ul>
        <Link href="/search?sort=wait" className="block border-t-2 border-stone-900 bg-stone-900 px-5 py-3 text-center text-sm font-bold text-white hover:bg-black">Compare all waits →</Link>
      </div>
      <div aria-hidden className="display absolute -bottom-6 -right-5 grid h-24 w-24 rotate-12 place-items-center rounded-full bg-[#d9421c] p-2 text-center text-[13px] font-extrabold leading-tight text-white shadow-md">No app.<br />No signup.</div>
    </div>
  );
}
