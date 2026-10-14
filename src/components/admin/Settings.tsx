"use client";
import { useState } from "react";
import type { Settings as S } from "@/lib/types";
import { Badge, Field, Loading, PageHeader, Panel, Switch, confirmBox, useAct, useAdminData } from "./kit";

interface D { settings: S; google: boolean; adminEmails: number; callback: string }

export default function Settings() {
  const { data, reload } = useAdminData<D>("settings", "", 0);
  const act = useAct(reload);
  const [f, setF] = useState<S | null>(null);
  if (data && !f) setF(data.settings);
  if (!data || !f) return <Loading />;
  const set = <K extends keyof S>(k: K, v: S[K]) => setF({ ...f, [k]: v });
  const save = (fields: Partial<S>, msg = "Settings saved") => act({ action: "settings.update", fields }, msg);

  return (
    <>
      <PageHeader title="Settings" sub="Platform-wide configuration. Changes apply immediately." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Branding & support">
          <div className="space-y-3">
            <Field label="Platform name"><input className="input" value={f.platformName} onChange={(e) => set("platformName", e.target.value)} /></Field>
            <Field label="Support email"><input className="input" value={f.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} /></Field>
            <Field label="Site-wide announcement" hint="Shown as a banner on every public page. Leave empty to hide."><input className="input" value={f.announcement} onChange={(e) => set("announcement", e.target.value)} placeholder="e.g. Scheduled maintenance tonight 2–3am" /></Field>
            <button className="btn btn-primary" onClick={() => save({ platformName: f.platformName, supportEmail: f.supportEmail, announcement: f.announcement })}>Save</button>
          </div>
        </Panel>

        <Panel title="Access & moderation">
          <Switch checked={f.allowSignups} onChange={(v) => { set("allowSignups", v); save({ allowSignups: v }); }} label="Allow new sign-ups" hint="Turn off to freeze registration (existing users can still sign in)." />
          <Switch checked={f.requireApproval} onChange={(v) => { set("requireApproval", v); save({ requireApproval: v }); }} label="Require approval for new businesses" hint="New businesses stay hidden until an admin approves them." />
        </Panel>

        <Panel title="Wait-time display">
          <Field label="“Busy” threshold (minutes)" hint={`Waits under ${f.busyThresholdMin} min show green, up to ${f.busyThresholdMin * 2} min amber, beyond that red.`}>
            <div className="flex gap-2"><input type="number" min={1} max={240} className="input !w-28" value={f.busyThresholdMin} onChange={(e) => set("busyThresholdMin", Number(e.target.value))} /><button className="btn btn-dark" onClick={() => save({ busyThresholdMin: f.busyThresholdMin })}>Save</button></div>
          </Field>
        </Panel>

        <Panel title="Search ranking weights" actions={<Badge tone="green">Transparent</Badge>}>
          <p className="mb-3 text-sm text-muted">Relevance is purely a text-match score. These weights are the only inputs: there is no paid placement or hidden boost.</p>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(f.rankingWeights) as (keyof S["rankingWeights"])[]).map((k) => (
              <Field key={k} label={k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}><input type="number" min={0} max={1000} className="input !py-2" value={f.rankingWeights[k]} onChange={(e) => setF({ ...f, rankingWeights: { ...f.rankingWeights, [k]: Number(e.target.value) } })} /></Field>
            ))}
          </div>
          <button className="btn btn-dark mt-3" onClick={() => save({ rankingWeights: f.rankingWeights }, "Ranking updated")}>Save weights</button>
        </Panel>

        <Panel title="Google sign-in" actions={<Badge tone={data.google ? "green" : "amber"}>{data.google ? "Configured" : "Not configured"}</Badge>}>
          {data.google ? (
            <p className="text-sm text-muted">Customers, merchants and admins can continue with Google. {data.adminEmails} email{data.adminEmails === 1 ? "" : "s"} on the <code>ADMIN_EMAILS</code> allowlist {data.adminEmails === 1 ? "is" : "are"} promoted to admin on sign-in.</p>
          ) : (
            <div className="space-y-2 text-sm text-muted">
              <p>Create an OAuth client in Google Cloud Console (type “Web application”) and add this authorised redirect URI:</p>
              <code className="block break-all rounded-lg bg-slate-100 p-2 text-xs text-slate-700">{data.callback}</code>
              <p>Then set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> (and optionally <code>ADMIN_EMAILS</code>) in the environment and restart.</p>
            </div>
          )}
        </Panel>

        <Panel title="Data & storage">
          <div className="flex flex-wrap gap-2">
            {["businesses", "users", "tickets"].map((t) => <a key={t} className="btn btn-ghost btn-sm" href={`/api/admin/export?type=${t}`}>⬇ Export {t}</a>)}
          </div>
          <p className="mt-3 text-xs text-muted">Storage: local JSON file. Migrate to Postgres with <code>supabase/schema.sql</code> for multi-instance production.</p>
        </Panel>

        <Panel title="Danger zone" className="lg:col-span-2 border border-red-100">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">Reset every business, queue, ticket and user back to the demo dataset. Your admin session is preserved.</p>
            <button className="btn btn-danger" onClick={() => confirmBox("Reset ALL data to the demo seed? This cannot be undone.") && act({ action: "demo.reset" }, "Demo data restored")}>Reset to demo data</button></div>
        </Panel>
      </div>
    </>
  );
}
