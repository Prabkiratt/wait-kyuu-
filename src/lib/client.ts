"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Subscribe to a Server-Sent Events endpoint. EventSource reconnects automatically. */
export function useLive<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d && typeof d === "object" && "error" in d) {
        setError({ message: String(d.error) });
        es.close();
        setConnected(false);
      } else {
        setError(null);
        setData(d as T);
      }
    };
    es.onerror = () => {
      setConnected(false);
      // a 401/404 response closes the stream for good; probe once to learn why
      if (es.readyState === EventSource.CLOSED) {
        fetch(url, { headers: { Accept: "application/json" } })
          .then(async (r) => { if (!r.ok) setError({ message: (await r.json().catch(() => ({}))).error ?? "Error", status: r.status }); })
          .catch(() => setError({ message: "Network error" }));
      }
    };
    return () => es.close();
  }, [url]);

  return { data, error, connected };
}

export async function post<T = Record<string, unknown>>(url: string, payload: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Request failed");
  return j as T;
}

export interface Loc { lat: number; lng: number; label: string }
export const DEFAULT_LOC: Loc = { lat: 12.9716, lng: 77.5946, label: "Bengaluru centre" };

/** Customer location: remembered per browser; "Near me" asks the browser, areas can be picked manually. */
export function useLocation() {
  const [loc, setLocState] = useState<Loc>(DEFAULT_LOC);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const s = localStorage.getItem("vq_loc");
      if (s) setLocState(JSON.parse(s));
    } catch { /* storage unavailable */ }
  }, []);
  const setLoc = useCallback((l: Loc) => {
    setLocState(l);
    try { localStorage.setItem("vq_loc", JSON.stringify(l)); } catch { /* ignore */ }
  }, []);
  const locate = useCallback(() => {
    if (!navigator.geolocation) return setLocError("Location isn't available in this browser");
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, label: "Near me" }); setLocating(false); },
      () => { setLocError("Couldn't get your location. Pick an area instead."); setLocating(false); },
      { timeout: 8000 },
    );
  }, [setLoc]);
  return { loc, setLoc, locate, locating, locError };
}

export function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t.current);
  }, [v, ms]);
  return d;
}

/** Saved businesses and the customer's active tickets live in this browser only (no account needed). */
function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}
export function useFavorites() {
  const [favs, setFavs] = useState<string[]>([]);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    (async () => {
      const local = readJson<string[]>("vq_favs", []);
      const me = await fetch("/api/account").then((r) => r.json()).catch(() => ({ user: null }));
      if (!me.user) return setFavs(local);
      setAuthed(true);
      if (local.length) { // adopt favourites saved before signing in
        const m = await post<{ favoriteSlugs: string[] }>("/api/account", { action: "mergeFavorites", slugs: local }).catch(() => null);
        try { localStorage.removeItem("vq_favs"); } catch { /* ignore */ }
        return setFavs(m?.favoriteSlugs ?? me.favoriteSlugs);
      }
      setFavs(me.favoriteSlugs);
    })();
  }, []);
  const toggle = (slug: string) => {
    const n = favs.includes(slug) ? favs.filter((x) => x !== slug) : [...favs, slug];
    setFavs(n);
    if (authed) post("/api/account", { action: "toggleFavorite", slug }).catch(() => setFavs(favs));
    else try { localStorage.setItem("vq_favs", JSON.stringify(n)); } catch { /* ignore */ }
  };
  return { favs, toggle };
}
export const saveTicket = (slug: string, token: string) => {
  try { localStorage.setItem("vq_tickets", JSON.stringify({ ...readJson<Record<string, string>>("vq_tickets", {}), [slug]: token })); } catch { /* ignore */ }
};
export const getTicket = (slug: string) => readJson<Record<string, string>>("vq_tickets", {})[slug] ?? null;
export const forgetTicket = (slug: string) => {
  const m = readJson<Record<string, string>>("vq_tickets", {});
  delete m[slug];
  try { localStorage.setItem("vq_tickets", JSON.stringify(m)); } catch { /* ignore */ }
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
