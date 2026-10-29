"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import SignOutButton from "../auth/SignOutButton";

type Metrics = { assignedCustomers: number; activeCustomers: number; portfolioBalance: number; adjustments: number };
type Audit = { id: string; action: string; created_at: string };

export default function PersonalAdminReports() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => { void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setNotice("Sign in as a Personal Admin first.");
      const response = await fetch("/api/personal-admin/reports", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const result = await response.json();
      if (!result.ok) return setNotice(result.error || "Unable to load reports.");
      setMetrics(result.metrics); setAudit(result.audit || []);
    })(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className="bank-shell min-h-screen p-4 text-white sm:p-8"><div className="mx-auto max-w-5xl"><header className="bank-surface rounded-xl p-5"><div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-green-400">Personal Admin</p><h1 className="mt-2 text-3xl font-black">Portfolio reports</h1><p className="mt-2 text-sm text-zinc-400">Tenant-scoped metrics and immutable operations history.</p></div><SignOutButton className="w-full sm:w-auto" /></div></header><Link href="/personal-admin/dashboard" className="bank-button mt-4 inline-block rounded-lg px-3 py-2 text-sm font-bold">Back to dashboard</Link>{notice && <p role="status" className="mt-4 rounded bg-white/5 p-3 text-sm">{notice}</p>}{metrics && <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Assigned customers", metrics.assignedCustomers], ["Active customers", metrics.activeCustomers], ["Portfolio balance", `USD ${metrics.portfolioBalance.toLocaleString()}`], ["Audited adjustments", metrics.adjustments]].map(([label, value]) => <article key={String(label)} className="bank-surface rounded-xl p-4"><p className="text-xs text-zinc-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></article>)}</section>}<section className="bank-surface mt-5 rounded-xl p-5"><h2 className="font-black">Recent audit activity</h2>{audit.length ? audit.map(item => <article key={item.id} className="mt-3 rounded bg-white/5 p-3"><p className="font-bold">{item.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-zinc-400">{new Date(item.created_at).toLocaleString()}</p></article>) : <p className="mt-3 text-sm text-zinc-400">No Personal Admin audit events yet.</p>}</section></div></main>;
}
