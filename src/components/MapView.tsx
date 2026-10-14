"use client";
import { useEffect, useRef } from "react";
import type { Map as LMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BusinessCard } from "@/lib/types";
import { waitLabel } from "./ui";

const COLORS = { green: "#16a34a", amber: "#d97706", red: "#dc2626", gray: "#64748b" } as const;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function MapView({ items, center }: { items: BusinessCard[]; center: { lat: number; lng: number } }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const L = useRef<typeof import("leaflet") | null>(null);

  useEffect(() => {
    let dead = false;
    import("leaflet").then((mod) => {
      if (dead || !el.current || map.current) return;
      L.current = mod;
      map.current = mod.map(el.current, { zoomControl: true }).setView([center.lat, center.lng], 13);
      mod.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
      draw();
    });
    return () => { dead = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const m = map.current, lf = L.current;
    if (!m || !lf) return;
    markers.current.forEach((x) => x.remove());
    markers.current = items.map((b) => {
      const tone = b.tone;
      const text = b.waitMin !== null && b.status === "OPEN" ? (b.waitMin === 0 ? "No wait" : `${b.waitMin} min`) : b.status === "NO_LIVE_DATA" ? "No live data" : b.status === "CLOSED" ? "Closed" : "Paused";
      const icon = lf.divIcon({ className: "", html: `<div class="vq-pin" style="background:${COLORS[tone]}">${text}</div>`, iconSize: [0, 0] });
      return lf.marker([b.lat, b.lng], { icon }).addTo(m)
        .bindPopup(`<strong>${esc(b.name)}</strong><br>${esc(b.category.name)} · ${esc(waitLabel(b.status, b.waitMin))}<br><a href="/business/${encodeURIComponent(b.slug)}">View queue →</a>`);
    });
    if (items.length) m.fitBounds(lf.latLngBounds(items.map((b) => [b.lat, b.lng] as [number, number])).pad(0.2), { maxZoom: 15 });
  }
  useEffect(draw, [items]);

  return <div ref={el} className="h-[480px] w-full overflow-hidden rounded-2xl border border-black/15" role="application" aria-label="Map of nearby businesses" />;
}
