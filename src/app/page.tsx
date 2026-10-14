import Link from "next/link";
import { db } from "@/lib/store";
import { ACTIVE } from "@/lib/types";
import MarketBrowser from "@/components/MarketBrowser";
import ShortestWaits from "@/components/ShortestWaits";
import { photo } from "@/lib/photo";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", t: "Look before you leave", d: "Search by what you need. Every result shows the wait right now, not last Tuesday's guess." },
  { n: "02", t: "Take a ticket from your sofa", d: "No app, no account. Scan the QR at the door or join remotely. You get a number and a live position." },
  { n: "03", t: "Walk in when it's your turn", d: "Watch the line shrink on your phone. We nudge you at 'you're next', so the waiting happens somewhere nicer." },
];

export default function Home() {
  const cats = db.categories.filter((c) => c.imageUrl).slice(0, 8);
  const cover = (slug: string) => db.categories.find((c) => c.slug === slug)?.imageUrl;
  const live = db.queues.filter((q) => q.status === "open" && db.businesses.some((b) => b.id === q.businessId && b.approval === "approved" && b.liveQueue)).length;
  const waiting = db.tickets.filter((t) => ACTIVE.includes(t.status)).length;
  const served = db.tickets.filter((t) => t.status === "COMPLETED").length;
  const bizCount = db.businesses.filter((b) => b.approval === "approved").length;

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-14 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pb-20 lg:pt-16">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">Bengaluru · {bizCount} places · {live} live queues</p>
          <h1 className="display text-[2.9rem] font-extrabold leading-[0.98] sm:text-7xl">Find a <span className="hl">shorter wait.</span></h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-stone-600">See live waiting times at nearby businesses and join the queue before you arrive.</p>
          <form action="/search" className="mt-8 flex max-w-xl gap-2 rounded-2xl border-2 border-stone-900 bg-white p-1.5 shadow-[4px_4px_0_#1a1a17]">
            <input name="q" className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-lg outline-none placeholder:text-stone-400" placeholder="What are you looking for?" aria-label="Search" />
            <button className="btn btn-primary !px-6">Search</button>
          </form>
          <p className="mt-5 text-sm text-stone-600">
            Try{" "}
            {["salon", "barber", "dentist", "restaurant", "car wash", "clinic"].map((s, i, a) => (
              <span key={s}><Link href={`/search?q=${s}`} className="font-semibold text-stone-900 underline decoration-[#ffc21a] decoration-2 underline-offset-4 hover:decoration-stone-900">{s}</Link>{i < a.length - 1 ? ", " : ""}</span>
            ))}
          </p>
        </div>
        <ShortestWaits />
      </section>

      <section className="border-y border-black/10 bg-white">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-4 py-7 sm:grid-cols-4">
          {[[bizCount, "businesses listed"], [live, "queues open"], [waiting, "people in line now"], [served.toLocaleString(), "customers served"]].map(([v, l]) => (
            <div key={String(l)} className="sm:border-l sm:border-black/10 sm:pl-6 sm:first:border-0 sm:first:pl-0">
              <dt className="display text-4xl font-extrabold tabular-nums">{v}</dt><dd className="text-sm text-stone-600">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between"><h2 className="display text-3xl font-extrabold sm:text-4xl">Browse by category</h2><Link href="/search" className="text-sm font-semibold underline underline-offset-4">All businesses</Link></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cats.map((c) => (
            <Link key={c.slug} href={`/search?cat=${c.slug}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:border-black/40">
              <div className="h-32 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo(c.imageUrl, 500)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
              <div className="flex items-center justify-between px-4 py-3"><span className="display text-lg font-bold">{c.name}</span><span aria-hidden className="transition group-hover:translate-x-1">→</span></div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4"><h2 className="display text-3xl font-extrabold sm:text-4xl">Near you</h2><p className="mb-5 mt-1 text-stone-600">Updated the second a queue moves.</p></div>
      <MarketBrowser />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="display max-w-xl text-3xl font-extrabold sm:text-4xl">Waiting is fine. Waiting <span className="hl">blindly</span> isn&apos;t.</h2>
        <div className="mt-10 grid gap-10 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="border-t-2 border-stone-900 pt-5">
              <span className="display text-5xl font-extrabold text-[#ffc21a] [-webkit-text-stroke:1.5px_#1a1a17]">{s.n}</span>
              <h3 className="display mt-3 text-xl font-bold">{s.t}</h3>
              <p className="mt-2 leading-relaxed text-stone-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="grid overflow-hidden rounded-3xl border-2 border-stone-900 bg-[#ffc21a] md:grid-cols-[1.2fr_0.8fr]">
          <div className="p-8 sm:p-12">
            <h2 className="display text-3xl font-extrabold leading-tight sm:text-5xl">Got a waiting room? Put the line on people&apos;s phones.</h2>
            <p className="mt-4 max-w-md text-stone-800">A one-tap dashboard, a printable QR code and a spot on the live marketplace. Set up in ten minutes, no hardware.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/merchant/login" className="btn btn-primary">List your business</Link><Link href="/merchant/login" className="btn border border-stone-900 bg-transparent text-stone-900 hover:bg-black/5">Sign in</Link></div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo(cover("barber"), 900)} alt="" loading="lazy" className="hidden h-full min-h-72 w-full object-cover md:block" />
        </div>
      </section>
    </>
  );
}
