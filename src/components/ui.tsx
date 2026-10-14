"use client";
import { useState } from "react";
import type { BusinessStatus } from "@/lib/types";
import { photo } from "@/lib/photo";

export { photo };

export type Tone = "green" | "amber" | "red" | "gray";
const TONES = {
  green: "bg-[#dff5df] text-[#14591d] ring-[#14591d]/25",
  amber: "bg-[#ffe9a8] text-[#6b4700] ring-[#6b4700]/25",
  red: "bg-[#ffd9cf] text-[#8a1f0a] ring-[#8a1f0a]/25",
  gray: "bg-[#ece7dc] text-[#55503f] ring-[#55503f]/20",
} as const;
export const DOT = { green: "#1f9d2e", amber: "#e09b00", red: "#d9421c", gray: "#8a8473" } as const;

export function waitLabel(status: BusinessStatus, waitMin: number | null) {
  switch (status) {
    case "NO_LIVE_DATA": return "Live queue unavailable";
    case "CLOSED": return "Closed";
    case "PAUSED": return "Queue paused";
    case "QUEUE_FULL": return "Queue full";
    default: return waitMin === 0 ? "No wait" : `${waitMin} min wait`;
  }
}

/** The product's headline element: live wait, always visually prominent. */
export function WaitBadge({ status, waitMin, tone, size = "md" }: { status: BusinessStatus; waitMin: number | null; tone: Tone; size?: "md" | "lg" }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg font-bold ring-1 ring-inset ${TONES[tone]} ${size === "lg" ? "px-4 py-2 text-lg" : "px-2.5 py-1.5 text-sm"}`}>
      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: DOT[tone] }} />
      {waitLabel(status, waitMin)}
    </span>
  );
}

export function Stars({ rating, count }: { rating: number | null; count?: number }) {
  if (rating === null) return <span className="text-sm text-muted">New</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold">
      <span className="text-[#e09b00]">★</span>{rating.toFixed(1)}
      {count !== undefined && <span className="font-normal text-muted">({count})</span>}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center gap-2 p-8 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: React.ReactNode }) {
  return <EmptyState icon="⚠️" title="Something's off" hint={message} action={action} />;
}

export function LiveTag({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold tracking-wide ${connected ? "text-emerald-700" : "text-slate-500"}`}>
      <span className={connected ? "live-dot" : "inline-block h-2 w-2 rounded-full bg-slate-400"} />
      {connected ? "LIVE" : "RECONNECTING…"}
    </span>
  );
}

/** Real photo with a gradient fallback if the image is missing or fails to load. */
export function Cover({ hue, icon, imageUrl, className = "", w = 800, children }: { hue: number; icon: string; imageUrl?: string | null; className?: string; w?: number; children?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const src = photo(imageUrl ?? undefined, w);
  return (
    <div className={`relative overflow-hidden bg-slate-200 ${className}`} style={failed || !src ? { background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 40%))` } : undefined}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-5xl">{icon}</span>
      )}
      {children}
    </div>
  );
}

export function Avatar({ name, picture, size = 36 }: { name: string; picture?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return picture && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={picture} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid place-items-center rounded-full bg-amber-100 font-bold text-stone-900" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</span>
  );
}
