"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { post } from "@/lib/client";
import { Avatar } from "./ui";

interface Me { user: { email: string; role: string; name: string; picture: string | null } | null }

export default function AuthMenu() {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => { fetch("/api/auth").then((r) => r.json()).then(setMe).catch(() => setMe({ user: null })); }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!me) return <span className="h-9 w-20" />;
  if (!me.user) return <Link href="/login" className="btn btn-primary !px-4 !py-2 !text-sm">Sign in</Link>;
  const u = me.user;
  const home = u.role === "admin" ? { href: "/admin", label: "Admin console" } : u.role === "merchant" ? { href: "/merchant", label: "Business dashboard" } : { href: "/account", label: "My account" };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className="rounded-full ring-2 ring-transparent transition hover:ring-amber-200">
        <Avatar name={u.name} picture={u.picture} />
      </button>
      {open && (
        <div role="menu" className="pop card absolute right-0 mt-2 w-60 overflow-hidden p-1 text-sm">
          <div className="border-b border-black/5 px-3 py-2"><p className="truncate font-semibold">{u.name}</p><p className="truncate text-xs text-muted">{u.email}</p></div>
          <Link role="menuitem" href={home.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-[#f3eee3]">{home.label}</Link>
          {u.role === "customer" && <Link role="menuitem" href="/account#tickets" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-[#f3eee3]">My tickets</Link>}
          <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50" onClick={async () => { await post("/api/auth", { action: "logout" }); setMe({ user: null }); setOpen(false); router.push("/"); router.refresh(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
