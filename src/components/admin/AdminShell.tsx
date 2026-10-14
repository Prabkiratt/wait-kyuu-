"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/lib/client";
import { Avatar } from "../ui";
import { ToastProvider } from "./kit";
import Logo from "../Logo";

export const NAV: { href: string; label: string; icon: string; group: string }[] = [
  { href: "overview", label: "Overview", icon: "📊", group: "Platform" },
  { href: "businesses", label: "Businesses", icon: "🏪", group: "Platform" },
  { href: "queues", label: "Live queues", icon: "⏱", group: "Platform" },
  { href: "tickets", label: "Tickets", icon: "🎟", group: "Platform" },
  { href: "users", label: "Users", icon: "👥", group: "People" },
  { href: "reviews", label: "Reviews", icon: "⭐", group: "People" },
  { href: "categories", label: "Categories", icon: "🗂", group: "Catalog" },
  { href: "settings", label: "Settings", icon: "⚙️", group: "System" },
  { href: "audit", label: "Audit log", icon: "📜", group: "System" },
];

/** Full-screen console shell. It covers the public site chrome so the admin feels like its own product. */
export default function AdminShell({ admin, platform, children }: { admin: { name: string; email: string; picture: string | null }; platform: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const groups = [...new Set(NAV.map((n) => n.group))];

  const sidebar = (
    <nav className="flex h-full flex-col bg-slate-900 text-slate-300" aria-label="Admin navigation">
      <div className="px-5 py-5"><Logo light size={32} /><p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Admin console</p></div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((g) => (
          <div key={g}>
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">{g}</p>
            {NAV.filter((n) => n.group === g).map((n) => {
              const active = path === `/admin/${n.href}`;
              return <Link key={n.href} href={`/admin/${n.href}`} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-amber-500/20 text-white" : "hover:bg-white/5 hover:text-white"}`}><span aria-hidden>{n.icon}</span>{n.label}</Link>;
            })}
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-white/10 p-3 text-sm">
        <Link href="/" className="block rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">↗ View public site</Link>
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar name={admin.name} picture={admin.picture} size={32} />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{admin.name}</p><p className="truncate text-[11px] text-slate-400">{admin.email}</p></div>
          <button title="Sign out" aria-label="Sign out" className="text-slate-400 hover:text-white" onClick={async () => { await post("/api/auth", { action: "logout" }); router.push("/login"); router.refresh(); }}>⎋</button>
        </div>
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="fixed inset-0 z-50 flex bg-[#f4f5fa] text-foreground">
        <div className="hidden w-64 shrink-0 lg:block">{sidebar}</div>
        {open && <div className="fixed inset-0 z-[60] flex lg:hidden"><div className="w-64">{sidebar}</div><button aria-label="Close menu" className="flex-1 bg-slate-900/50" onClick={() => setOpen(false)} /></div>}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-[#e6e8f0] bg-white px-4 py-3 lg:hidden">
            <button aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-lg border border-black/15" onClick={() => setOpen(true)}>☰</button>
            <p className="font-bold">{platform} admin</p>
          </header>
          <main className="flex-1 overflow-y-auto"><div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div></main>
        </div>
      </div>
    </ToastProvider>
  );
}
