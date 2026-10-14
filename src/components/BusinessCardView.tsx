"use client";
import Link from "next/link";
import type { BusinessCard } from "@/lib/types";
import { Cover, Stars, WaitBadge } from "./ui";

export default function BusinessCardView({ b, fav, onFav }: { b: BusinessCard; fav: boolean; onFav: (slug: string) => void }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-black/30">
      <div className="relative">
        <Link href={`/business/${b.slug}`} className="block" aria-label={`${b.name}: view live queue`}>
          <Cover hue={b.hue} icon={b.category.name[0]} imageUrl={b.imageUrl} w={640} className="h-44">
            <span className="absolute left-3 top-3 rounded-md bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-stone-800">{b.category.name}</span>
          </Cover>
        </Link>
        <button
          onClick={() => onFav(b.slug)} aria-label={fav ? "Remove from favourites" : "Save to favourites"} aria-pressed={fav}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-chili shadow-sm transition hover:scale-110"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.7 3 5.5 6.3 5.5c2 0 3.7 1.1 4.7 2.7h2c1-1.6 2.7-2.7 4.7-2.7 3.3 0 5.1 3.2 3.8 6.3C19.5 16.4 12 21 12 21Z" /></svg>
        </button>
      </div>
      {/* the wait is the headline: a ticket-style stub */}
      <div className="stub flex items-center justify-between border-b border-dashed border-black/20 bg-[#fffaf0] px-4 py-2.5">
        <WaitBadge status={b.status} waitMin={b.waitMin} tone={b.tone} />
        <span className="text-sm font-medium text-stone-700">{b.peopleWaiting === null ? "No live queue" : b.peopleWaiting === 0 ? "Nobody waiting" : `${b.peopleWaiting} in line`}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/business/${b.slug}`} className="display min-w-0 truncate text-xl font-bold leading-tight hover:underline">{b.name}</Link>
          <Stars rating={b.rating} count={b.reviewCount} />
        </div>
        <p className="truncate text-sm text-muted">{b.area}, {b.city}{b.distanceKm !== null && <> · {b.distanceKm} km away</>}</p>
      </div>
    </article>
  );
}
