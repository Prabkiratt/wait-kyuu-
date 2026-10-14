"use client";
import { useState } from "react";
import { Badge, DataTable, Loading, PageHeader, ago, useAct, useAdminData, type Col } from "./kit";

interface Row { id: string; number: string; name: string; phone: string | null; status: string; source: string; business: string; queue?: string; joinedAt: number }

export default function Tickets() {
  const [status, setStatus] = useState("");
  const { data, reload } = useAdminData<{ rows: Row[]; total: number }>("tickets", status ? `status=${status}` : "", 5000);
  const act = useAct(reload);
  if (!data) return <Loading />;
  const live = ["WAITING", "CALLED", "SERVING"];
  const cols: Col<Row>[] = [
    { key: "number", label: "Ticket", sort: (r) => r.number, className: "font-mono font-bold" },
    { key: "name", label: "Customer", sort: (r) => r.name },
    { key: "business", label: "Business", sort: (r) => r.business, render: (r) => <><p className="font-medium">{r.business}</p><p className="text-xs text-muted">{r.queue}</p></> },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "SERVING" ? "green" : r.status === "WAITING" ? "blue" : r.status === "COMPLETED" ? "gray" : "amber"}>{r.status.toLowerCase()}</Badge> },
    { key: "source", label: "Source" },
    { key: "joinedAt", label: "Joined", sort: (r) => r.joinedAt, render: (r) => ago(r.joinedAt) },
    { key: "act", label: "", render: (r) => live.includes(r.status) ? (
      <div className="flex justify-end gap-1"><button className="btn btn-ghost btn-sm" onClick={() => act({ action: "ticket.skip", id: r.id }, "Skipped")}>Skip</button><button className="btn btn-danger btn-sm" onClick={() => act({ action: "ticket.remove", id: r.id }, "Removed")}>Remove</button></div>) : null },
  ];
  return (
    <>
      <PageHeader title="Tickets" sub={`Latest 150 of ${data.total.toLocaleString()} tickets. Phone numbers are visible to admins only.`} actions={<a className="btn btn-ghost btn-sm" href="/api/admin/export?type=tickets">⬇ Export CSV</a>} />
      <DataTable rows={data.rows} cols={cols} searchText={(r) => `${r.number} ${r.name} ${r.business} ${r.phone ?? ""}`} pageSize={15}
        filters={<select className="input !w-auto !py-2 !text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{["WAITING", "SERVING", "COMPLETED", "SKIPPED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select>} />
    </>
  );
}
