"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import SignOutButton from "../auth/SignOutButton";

type Metrics = { assignedCustomers: number; activeCustomers: number; portfolioBalance: number; adjustments: number };
type Audit = { id: string; action: string; target_user_id?: string | null; created_at: string };

export default function PersonalAdminReports() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [notice, setNotice] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [action, setAction] = useState("");
  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession(); if (!session) return setNotice("Sign in as a Personal Admin first.");
    const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to); if (action) query.set("action", action);
    const response = await fetch(`/api/personal-admin/reports?${query}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" }); const result = await response.json(); if (!result.ok) return setNotice(result.error || "Unable to load reports."); setMetrics(result.metrics); setAudit(result.audit || []);
  }, [action, from, to]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const exportCsv = () => { const rows = [["Action", "Customer", "Recorded at"], ...audit.map(item => [item.action, item.target_user_id || "", item.created_at])]; const blob = new Blob([rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "aurex-portfolio-audit.csv"; link.click(); URL.revokeObjectURL(url); };
  return <main className="bank-shell min-h-screen p-4 text-white sm:p-8"><div className="mx-auto max-w-5xl"><header className="bank-surface rounded-xl p-5"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-green-400">Personal Admin</p><h1 className="mt-2 text-3xl font-black">Portfolio reports</h1><p className="mt-2 text-sm text-zinc-400">Tenant-scoped metrics and immutable operations history.</p></div><SignOutButton className="w-full sm:w-auto" /></div></header><Link href="/personal-admin/dashboard" className="bank-button mt-4 inline-block rounded-lg px-3 py-2 text-sm font-bold">Back to dashboard</Link>{notice && <p role="status" className="mt-4 rounded bg-white/5 p-3 text-sm">{notice}</p>}{metrics && <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Assigned customers", metrics.assignedCustomers], ["Active customers", metrics.activeCustomers], ["Portfolio balance", `USD ${metrics.portfolioBalance.toLocaleString()}`], ["Audited adjustments", metrics.adjustments]].map(([label, value]) => <article key={String(label)} className="bank-surface rounded-xl p-4"><p className="text-xs text-zinc-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>)}</section>}<section className="bank-surface mt-5 rounded-xl p-5"><form onSubmit={event => { event.preventDefault(); void load(); }} className="flex flex-wrap gap-3"><input type="date" value={from} onChange={event => setFrom(event.target.value)} className="rounded bg-white/10 p-2" /><input type="date" value={to} onChange={event => setTo(event.target.value)} className="rounded bg-white/10 p-2" /><input value={action} onChange={event => setAction(event.target.value)} placeholder="Exact audit action" className="rounded bg-white/10 p-2" /><button className="bank-button rounded px-3 py-2 text-sm">Filter</button><button type="button" onClick={exportCsv} className="rounded bg-green-400 px-3 py-2 text-sm font-bold text-black">Export CSV</button></form><h2 className="mt-5 font-black">Recent audit activity</h2>{audit.length ? audit.map(item => <article key={item.id} className="mt-3 rounded bg-white/5 p-3"><p className="font-bold">{item.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-zinc-400">{new Date(item.created_at).toLocaleString()}</p></article>) : <p className="mt-3 text-sm text-zinc-400">No Personal Admin audit events yet.</p>}</section></div></main>;
}
