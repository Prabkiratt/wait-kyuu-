import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import type { BusinessCard } from "./types";

/** Server-side base URL of the API host (Render). Never exposed to the browser. */
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/**
 * GET from the API during server rendering. Returns null instead of throwing: pages must still render
 * (with sensible fallbacks) when the API is cold-starting or unreachable, e.g. Render's free tier waking up.
 */
export async function apiGet<T>(path: string, opts: { forwardCookies?: boolean; timeoutMs?: number } = {}): Promise<T | null> {
  try {
    const h: Record<string, string> = {};
    if (opts.forwardCookies) {
      const cookie = (await headers()).get("cookie");
      if (cookie) h.cookie = cookie;
    }
    const res = await fetch(`${API_URL}${path}`, { headers: h, cache: "no-store", signal: AbortSignal.timeout(opts.timeoutMs ?? 6000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export interface Bootstrap {
  platformName: string; announcement: string; supportEmail: string; googleEnabled: boolean;
  demo: { businesses: { slug: string; name: string }[] } | null;
  categories: { id: string; slug: string; name: string; icon: string; imageUrl?: string }[];
  areas: { name: string; lat: number; lng: number }[];
  stats: { businesses: number; liveQueues: number; waiting: number; served: number };
}

export const FALLBACK: Bootstrap = {
  platformName: "Wait? Kyu?", announcement: "", supportEmail: "", googleEnabled: false, demo: null,
  categories: [], areas: [], stats: { businesses: 0, liveQueues: 0, waiting: 0, served: 0 },
};

/** One call per request, shared by the layout and the page. */
export const getBootstrap = cache(async (): Promise<Bootstrap> => (await apiGet<Bootstrap>("/api/public/bootstrap")) ?? FALLBACK);

export interface Me { user: { email: string; role: "customer" | "merchant" | "admin"; name: string; picture: string | null } | null }
export const getMe = cache(async (): Promise<Me> => (await apiGet<Me>("/api/auth", { forwardCookies: true })) ?? { user: null });

export type { BusinessCard };
