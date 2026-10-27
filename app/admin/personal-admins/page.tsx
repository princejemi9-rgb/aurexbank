"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminGate from "../../../src/components/auth/AdminGate";
import { THEME_PRESETS } from "../../../src/lib/branding";
import { supabase } from "../../../src/lib/supabase";

type Permissions = {
  manage_customers?: boolean;
  manage_support?: boolean;
  manage_reports?: boolean;
  manage_financial_adjustments?: boolean;
};
type TenantAdmin = {
  user_id: string; full_name: string; email: string; phone: string; status: string; referral_code: string;
  permissions?: Permissions;
  personal_admin_branding?: { configuration?: { bankName?: string; themeId?: string } }[];
};
const PERMISSIONS = ["manage_customers", "manage_support", "manage_reports", "manage_financial_adjustments"] as const;

export default function PersonalAdminsPage() {
  const [admins, setAdmins] = useState<TenantAdmin[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const headers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` };
  };
  const load = async () => {
    const response = await fetch("/api/admin/personal-admins", { headers: await headers() });
    const data = await response.json();
    if (data.ok) setAdmins(data.personalAdmins || []);
    else setNotice(data.error || "Unable to load Personal Admins.");
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
    // initial remote synchronization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const action = async (personalAdminId: string, actionName: string, data: Record<string, unknown> = {}) => {
    if (["suspended", "rejected"].includes(String(data.status)) && !window.confirm("Confirm this sensitive status change?")) return;
    setBusy(`${personalAdminId}:${actionName}`);
    const response = await fetch("/api/admin/personal-admins", { method: "POST", headers: await headers(), body: JSON.stringify({ personalAdminId, action: actionName, ...data }) });
    const result = await response.json();
    setNotice(result.ok ? "Saved." : result.error || "Unable to save.");
    setBusy("");
    if (result.ok) void load();
  };
  const filtered = useMemo(() => admins.filter(item => `${item.full_name} ${item.email} ${item.referral_code}`.toLowerCase().includes(query.toLowerCase())), [admins, query]);
  return <AdminGate><main className="bank-shell min-h-screen p-4 text-white sm:p-7"><div className="mx-auto max-w-6xl">
    <header className="bank-surface rounded-xl p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-green-400">Super Admin</p><h1 className="mt-2 text-3xl font-black">Personal Admin management</h1><p className="mt-2 text-sm text-zinc-400">Each application is approved once. Suspension and reactivation preserve that original approval.</p></header>
    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, or referral code" className="mt-5 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4" />
    {notice && <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm">{notice}</p>}
    <div className="mt-5 grid gap-4">{filtered.map(admin => {
      const brand = admin.personal_admin_branding?.[0]?.configuration; const permissions = admin.permissions || {}; const key = `${admin.user_id}:`;
      const savePermissions = () => {
        const next = Object.fromEntries(PERMISSIONS.map(permission => [permission, (document.getElementById(`${permission}-${admin.user_id}`) as HTMLInputElement).checked]));
        void action(admin.user_id, "setPermissions", { permissions: next });
      };
      return <article key={admin.user_id} className="bank-surface rounded-xl p-5"><div className="flex flex-col gap-4 sm:flex-row sm:justify-between"><div><h2 className="text-xl font-black">{admin.full_name}</h2><p className="text-sm text-zinc-400">{admin.email} · {admin.phone}</p><p className="mt-2 text-xs font-bold uppercase tracking-wide text-green-300">{admin.status} · {admin.referral_code}</p><p className="mt-2 text-sm text-zinc-400">Brand: {brand?.bankName || "Default Aurex"} · {brand?.themeId || "aurex-luxury"}</p></div><div className="flex flex-wrap gap-2">{admin.status === "pending_approval" && <button disabled={!!busy} onClick={() => void action(admin.user_id, "setStatus", { status: "approved" })} className="rounded-lg bg-green-400 px-3 py-2 text-sm font-black text-black">Approve once</button>}{admin.status === "approved" && <button disabled={!!busy} onClick={() => void action(admin.user_id, "setStatus", { status: "suspended" })} className="bank-button rounded-lg px-3 py-2 text-sm font-black">Suspend</button>}{admin.status === "suspended" && <button disabled={!!busy} onClick={() => void action(admin.user_id, "reactivate")} className="rounded-lg bg-green-400 px-3 py-2 text-sm font-black text-black">Reactivate</button>}<button disabled={!!busy} onClick={() => void action(admin.user_id, "setStatus", { status: "rejected" })} className="bank-button rounded-lg px-3 py-2 text-sm font-black">Reject</button><Link href={`/admin/personal-admins/${admin.user_id}`} className="bank-button rounded-lg px-3 py-2 text-sm font-black">Audit</Link></div></div>
        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 lg:grid-cols-3"><input id={`customer-${admin.user_id}`} placeholder="Customer UUID to assign / reassign" className="h-11 rounded-lg border border-white/10 bg-black/30 px-3 text-sm" /><button disabled={!!busy} onClick={() => { const customerId = (document.getElementById(`customer-${admin.user_id}`) as HTMLInputElement).value.trim(); if (customerId) void action(admin.user_id, "assignCustomer", { customerId }); }} className="bank-button rounded-lg px-3 py-2 text-sm font-black">Assign customer</button><div className="flex flex-wrap items-center gap-3 text-xs">{PERMISSIONS.map(permission => <label key={permission} className="flex items-center gap-1"><input id={`${permission}-${admin.user_id}`} type="checkbox" defaultChecked={permissions[permission] === true} />{permission.replace("manage_", "").replaceAll("_", " ")}</label>)}<button onClick={savePermissions} className="bank-button rounded-lg px-3 py-2 text-sm font-black">Save permissions</button></div></div>
        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row"><input id={`name-${admin.user_id}`} defaultValue={brand?.bankName || "Aurex Bank"} className="h-11 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm" /><select id={`theme-${admin.user_id}`} defaultValue={brand?.themeId || "aurex-luxury"} className="h-11 rounded-lg border border-white/10 bg-black/30 px-3 text-sm">{Object.entries(THEME_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select><button disabled={busy === `${key}setBranding`} onClick={() => { const bankName = (document.getElementById(`name-${admin.user_id}`) as HTMLInputElement).value; const themeId = (document.getElementById(`theme-${admin.user_id}`) as HTMLSelectElement).value; void action(admin.user_id, "setBranding", { branding: { ...brand, bankName, themeId } }); }} className="rounded-lg bg-green-400 px-4 py-2 text-sm font-black text-black">Publish brand</button></div>
      </article>;
    })}{!filtered.length && <p className="p-5 text-sm text-zinc-400">No Personal Admin registrations found.</p>}</div>
  </div></main></AdminGate>;
}
