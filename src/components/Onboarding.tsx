"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { post } from "@/lib/client";

type Svc = { name: string; durationMin: string; price: string };
const STEPS = ["Business", "Services", "Queue", "Go live"];

export default function Onboarding({ categories, areas }: { categories: { id: string; name: string; icon: string }[]; areas: { name: string; lat: number; lng: number }[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: "", categoryId: "", description: "", phone: "", address: "", area: areas[0]?.name ?? "", city: "Bengaluru", lat: areas[0]?.lat ?? 12.97, lng: areas[0]?.lng ?? 77.59, imageUrl: "", open: "09:00", close: "21:00" });
  const [services, setServices] = useState<Svc[]>([{ name: "", durationMin: "30", price: "" }]);
  const [queue, setQueue] = useState({ name: "General Queue", avgServiceMin: "10", maxSize: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");

  useEffect(() => { // must be signed in
    fetch("/api/auth").then((r) => r.json()).then((j) => { if (!j.user) router.replace("/merchant/login"); else if (j.business) router.replace("/merchant"); });
  }, [router]);

  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  const next = () => {
    setErr("");
    if (step === 0) {
      if (f.name.trim().length < 2) return setErr("Enter your business name");
      if (!f.categoryId) return setErr("Choose a category");
      if (!/^[+\d][\d\s-]{6,18}$/.test(f.phone)) return setErr("Enter a valid phone number");
    }
    setStep(step + 1);
  };
  async function submit() {
    setBusy(true); setErr("");
    try {
      const r = await post<{ slug: string }>("/api/merchant/onboard", {
        ...f, services: services.filter((s) => s.name.trim()).map((s) => ({ name: s.name, durationMin: Number(s.durationMin), price: s.price === "" ? undefined : Number(s.price) })),
        queue: { name: queue.name, avgServiceMin: Number(queue.avgServiceMin), maxSize: queue.maxSize ? Number(queue.maxSize) : undefined },
      });
      setSlug(r.slug); setStep(3);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <ol className="mb-6 flex items-center gap-2 text-sm font-semibold">
        {STEPS.map((s, i) => <li key={s} className={`flex-1 rounded-full py-1.5 text-center ${i <= step ? "bg-brand text-white" : "bg-white text-muted"}`}>{i + 1}. {s}</li>)}
      </ol>
      <div className="card space-y-4 p-6">
        {step === 0 && (<>
          <h1 className="text-2xl font-extrabold">Tell us about your business</h1>
          <L t="Business name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={60} /></L>
          <L t="Category">
            <div className="flex flex-wrap gap-2">{categories.map((c) => <button type="button" key={c.id} aria-pressed={f.categoryId === c.id} onClick={() => set("categoryId", c.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${f.categoryId === c.id ? "border-brand bg-brand text-white" : "border-black/15 bg-white"}`}>{c.icon} {c.name}</button>)}</div>
          </L>
          <L t="Description"><textarea className="input" rows={2} maxLength={400} value={f.description} onChange={(e) => set("description", e.target.value)} /></L>
          <L t="Cover photo URL (optional)"><input className="input" placeholder="https://… (we use a category photo if empty)" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} /></L>
          <L t="Business phone"><input className="input" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></L>
          <L t="Address"><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} /></L>
          <L t="Area (sets your map location)">
            <div className="flex gap-2">
              <select className="input" value={f.area} onChange={(e) => { const a = areas.find((x) => x.name === e.target.value); setF((p) => ({ ...p, area: e.target.value, lat: a?.lat ?? p.lat, lng: a?.lng ?? p.lng })); }}>
                {areas.map((a) => <option key={a.name}>{a.name}</option>)}
              </select>
              <button type="button" className="btn btn-ghost whitespace-nowrap" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setF((x) => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude })), () => setErr("Couldn't read your location"))}>📍 Use mine</button>
            </div>
            <p className="mt-1 text-xs text-muted">Pin: {f.lat.toFixed(4)}, {f.lng.toFixed(4)}</p>
          </L>
          <div className="grid grid-cols-2 gap-3"><L t="Opens"><input type="time" className="input" value={f.open} onChange={(e) => set("open", e.target.value)} /></L><L t="Closes"><input type="time" className="input" value={f.close} onChange={(e) => set("close", e.target.value)} /></L></div>
        </>)}
        {step === 1 && (<>
          <h1 className="text-2xl font-extrabold">What do you offer?</h1>
          {services.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_5rem_auto] gap-2">
              <input className="input" placeholder="Service (e.g. Haircut)" value={s.name} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <input className="input" inputMode="numeric" placeholder="min" aria-label="Minutes" value={s.durationMin} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, durationMin: e.target.value } : x))} />
              <input className="input" inputMode="numeric" placeholder="₹" aria-label="Price" value={s.price} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
              <button type="button" aria-label="Remove service" className="px-2 text-muted" onClick={() => setServices(services.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => setServices([...services, { name: "", durationMin: "30", price: "" }])}>+ Add service</button>
        </>)}
        {step === 2 && (<>
          <h1 className="text-2xl font-extrabold">Create your queue</h1>
          <p className="text-sm text-muted">You can add more queues later (e.g. one per doctor or service).</p>
          <L t="Queue name"><input className="input" value={queue.name} onChange={(e) => setQueue({ ...queue, name: e.target.value })} /></L>
          <L t="Average time per customer (minutes)"><input className="input" inputMode="numeric" value={queue.avgServiceMin} onChange={(e) => setQueue({ ...queue, avgServiceMin: e.target.value })} /></L>
          <L t="Max people waiting (optional)"><input className="input" inputMode="numeric" value={queue.maxSize} onChange={(e) => setQueue({ ...queue, maxSize: e.target.value })} /></L>
        </>)}
        {step === 3 && (
          <div className="text-center">
            <div className="text-5xl">🎉</div>
            <h1 className="mt-2 text-2xl font-extrabold">You&apos;re live on the marketplace</h1>
            <p className="mt-1 text-muted">Print your QR code and put it where customers wait.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr/${slug}`} alt="QR code" className="mx-auto my-4 h-52 w-52" />
            <div className="flex gap-2"><Link className="btn btn-primary flex-1" href="/merchant">Open dashboard</Link><Link className="btn btn-ghost flex-1" href={`/business/${slug}`}>View public page</Link></div>
          </div>
        )}
        {err && <p role="alert" className="text-sm font-medium text-red-600">{err}</p>}
        {step < 3 && (
          <div className="flex gap-2">
            {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
            {step < 2 ? <button className="btn btn-primary flex-1" onClick={next}>Continue</button> : <button className="btn btn-primary flex-1" disabled={busy} onClick={submit}>{busy ? "Publishing…" : "Publish my business"}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

const L = ({ t, children }: { t: string; children: React.ReactNode }) => <div className="block text-sm font-semibold"><span className="mb-1 block">{t}</span>{children}</div>;
