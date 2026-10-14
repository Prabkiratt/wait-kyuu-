"use client";
import { useState } from "react";
import { Avatar } from "../ui";
import { Badge, DataTable, Drawer, Field, Loading, PageHeader, Panel, ago, confirmBox, useAct, useAdminData, type Col } from "./kit";

interface Row {
  id: string; email: string; name: string | null; picture: string | null; role: string; status: string; google: boolean; password: boolean;
  business: string | null; tickets: number; favorites: number; createdAt: number; lastLoginAt: number | null;
}

export default function Users() {
  const { data, reload } = useAdminData<{ rows: Row[] }>("users");
  const act = useAct(reload);
  const [sel, setSel] = useState<string | null>(null);
  const [role, setRole] = useState("");
  if (!data) return <Loading />;
  const user = data.rows.find((r) => r.id === sel);

  const cols: Col<Row>[] = [
    { key: "email", label: "User", sort: (r) => r.email, render: (r) => (
      <div className="flex items-center gap-3"><Avatar name={r.name ?? r.email} picture={r.picture} size={34} /><div className="min-w-0"><p className="truncate font-semibold">{r.name ?? r.email.split("@")[0]}</p><p className="truncate text-xs text-muted">{r.email}</p></div></div>) },
    { key: "role", label: "Role", sort: (r) => r.role, render: (r) => <Badge tone={r.role === "admin" ? "red" : r.role === "merchant" ? "blue" : "gray"}>{r.role}</Badge> },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "active" ? "green" : "red"}>{r.status}</Badge> },
    { key: "login", label: "Sign-in", render: (r) => <span className="text-xs text-muted">{[r.google && "Google", r.password && "Password"].filter(Boolean).join(" + ") || "-"}</span> },
    { key: "business", label: "Business", render: (r) => r.business ?? "-" },
    { key: "tickets", label: "Tickets", sort: (r) => r.tickets, className: "tabular-nums" },
    { key: "lastLoginAt", label: "Last seen", sort: (r) => r.lastLoginAt ?? 0, render: (r) => ago(r.lastLoginAt) },
    { key: "createdAt", label: "Joined", sort: (r) => r.createdAt, render: (r) => new Date(r.createdAt).toLocaleDateString() },
  ];

  return (
    <>
      <PageHeader title="Users" sub="Customers, business owners and administrators." actions={<a className="btn btn-ghost btn-sm" href="/api/admin/export?type=users">⬇ Export CSV</a>} />
      <DataTable rows={data.rows.filter((r) => !role || r.role === role)} cols={cols} onRow={(r) => setSel(r.id)} searchText={(r) => `${r.email} ${r.name ?? ""} ${r.business ?? ""}`}
        filters={<select className="input !w-auto !py-2 !text-sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role"><option value="">All roles</option><option value="customer">Customers</option><option value="merchant">Merchants</option><option value="admin">Admins</option></select>} />
      {user && <UserEditor key={user.id} u={user} act={act} onClose={() => setSel(null)} />}
    </>
  );
}

function UserEditor({ u, act, onClose }: { u: Row; act: (p: Record<string, unknown>, ok?: string) => Promise<boolean>; onClose: () => void }) {
  const [name, setName] = useState(u.name ?? "");
  const [role, setRole] = useState(u.role);
  const [pw, setPw] = useState("");
  return (
    <Drawer open onClose={onClose} title={u.name ?? u.email} sub={u.email}>
      <div className="space-y-5">
        <div className="flex items-center gap-4"><Avatar name={u.name ?? u.email} picture={u.picture} size={56} /><div className="text-sm text-muted"><p>Joined {new Date(u.createdAt).toLocaleDateString()} · last seen {ago(u.lastLoginAt)}</p><p>{u.tickets} tickets · {u.favorites} saved{u.business ? ` · owns ${u.business}` : ""}</p></div></div>
        <Panel title="Profile & role">
          <div className="space-y-3">
            <Field label="Display name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Role" hint="Admins have full control of the platform."><select className="input" value={role} onChange={(e) => setRole(e.target.value)}><option value="customer">Customer</option><option value="merchant">Merchant</option><option value="admin">Admin</option></select></Field>
            <button className="btn btn-primary" onClick={() => act({ action: "user.update", id: u.id, fields: { name, role } }, "User updated")}>Save</button>
          </div>
        </Panel>
        <Panel title="Set a new password" ><div className="flex gap-2"><input type="password" autoComplete="new-password" className="input" placeholder="Min. 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn btn-dark" onClick={async () => { if (await act({ action: "user.setPassword", id: u.id, password: pw }, "Password updated")) setPw(""); }}>Set</button></div></Panel>
        <Panel title="Access">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{u.status === "active" ? "Suspending signs the user out and blocks sign-in." : "This account is suspended."}</p>
            {u.status === "active"
              ? <button className="btn btn-danger" onClick={() => confirmBox(`Suspend ${u.email}?`) && act({ action: "user.suspend", id: u.id }, "User suspended")}>Suspend</button>
              : <button className="btn btn-dark" onClick={() => act({ action: "user.unsuspend", id: u.id }, "User reinstated")}>Reinstate</button>}
          </div>
        </Panel>
        <Panel title="Delete account">
          <p className="mb-3 text-sm text-muted">Removes the account. Their past tickets are kept but anonymised.{u.business && ` They own “${u.business}”, which will also be deleted.`}</p>
          <button className="btn btn-danger" onClick={async () => { if (confirmBox(`Delete ${u.email}${u.business ? ` AND the business ${u.business}` : ""}?`) && (await act({ action: "user.delete", id: u.id, withBusiness: true }, "User deleted"))) onClose(); }}>Delete user</button>
        </Panel>
      </div>
    </Drawer>
  );
}
