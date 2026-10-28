"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import SignOutButton from "../auth/SignOutButton";

type Form = { fullName: string; email: string; phone: string; country: string; accountType: "personal" | "business"; address: string };
const initialForm: Form = { fullName: "", email: "", phone: "", country: "", accountType: "personal", address: "" };

export default function NewCustomer() {
  const [form, setForm] = useState<Form>(initialForm);
  const [accessError, setAccessError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return setAccessError("Sign in to access Personal Admin operations.");
    const response = await fetch("/api/personal-admin", { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!result?.personalAdmin || result.personalAdmin.status !== "approved" || result.personalAdmin.permissions?.manage_customers !== true) {
      setAccessError(result?.error || "Customer-management permission is required.");
    }
  })(); }, []);

  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setSuccess("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Your session has expired. Please sign in again."); setBusy(false); return; }
    const response = await fetch("/api/personal-admin/customers", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(form),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok || !result?.ok) setError(result?.error || "Unable to create the customer invitation. Please try again.");
    else { setSuccess(`Invitation sent to ${result.customer.email}. The customer chooses their own password from the secure email link.`); setForm(initialForm); }
    setBusy(false);
  };

  return <main className="bank-shell min-h-screen p-4 text-white sm:p-8"><div className="mx-auto max-w-4xl">
    <header className="bank-surface rounded-xl p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-green-400">Personal Admin Portal</p><h1 className="mt-2 text-3xl font-black">Create customer</h1><p className="mt-2 text-sm text-zinc-400">Invite a customer securely and add them to your portfolio.</p></div><SignOutButton className="w-full sm:w-auto" /></div></header>
    <nav className="mt-4 flex flex-wrap gap-2"><Link href="/personal-admin/dashboard" className="bank-button rounded-lg px-3 py-2 text-sm font-bold">Dashboard</Link><Link href="/personal-admin/customers" className="bank-button rounded-lg px-3 py-2 text-sm font-bold">Customers</Link></nav>
    <section className="bank-surface mt-6 rounded-xl p-5 sm:p-6">
      {accessError ? <p role="alert" className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">{accessError}</p> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-lg border border-green-300/20 bg-green-400/5 p-4 text-sm text-zinc-300">Aurex sends the customer a single-use invitation. They create their own password; Personal Admins never receive or handle customer credentials.</div>
        <label className="grid gap-2 text-sm font-bold">Full name<input required value={form.fullName} onChange={event => update("fullName", event.target.value)} maxLength={120} autoComplete="name" className="rounded-lg border border-white/10 bg-black/20 p-3 font-normal outline-none focus:border-green-400" /></label>
        <label className="grid gap-2 text-sm font-bold">Email address<input required type="email" value={form.email} onChange={event => update("email", event.target.value)} maxLength={254} autoComplete="email" className="rounded-lg border border-white/10 bg-black/20 p-3 font-normal outline-none focus:border-green-400" /></label>
        <label className="grid gap-2 text-sm font-bold">Phone<input required type="tel" value={form.phone} onChange={event => update("phone", event.target.value)} maxLength={40} autoComplete="tel" className="rounded-lg border border-white/10 bg-black/20 p-3 font-normal outline-none focus:border-green-400" /></label>
        <label className="grid gap-2 text-sm font-bold">Country<input required value={form.country} onChange={event => update("country", event.target.value)} maxLength={80} autoComplete="country-name" className="rounded-lg border border-white/10 bg-black/20 p-3 font-normal outline-none focus:border-green-400" /></label>
        <label className="grid gap-2 text-sm font-bold">Account type<select value={form.accountType} onChange={event => update("accountType", event.target.value as Form["accountType"])} className="rounded-lg border border-white/10 bg-black/20 p-3 font-normal outline-none focus:border-green-400"><option className="text-black" value="personal">Personal</option><option className="text-black" value="business">Business</option></select></label>
        <label className="grid gap-2 text-sm font-bold sm:col-span-2">Address <span className="font-normal text-zinc-500">(optional)</span><textarea value={form.address} onChange={event => update("address", event.target.value)} maxLength={500} autoComplete="street-address" rows={3} className="resize-y rounded-lg border border-white/10 bg-black/20 p-3 font-normal outline-none focus:border-green-400" /></label>
        {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100 sm:col-span-2">{error}</p>}
        {success && <p role="status" className="rounded-lg border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-100 sm:col-span-2">{success}</p>}
        <button disabled={busy} className="rounded-lg bg-green-400 px-5 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2">{busy ? "Sending secure invitation…" : "Send secure customer invitation"}</button>
      </form>}
    </section>
  </div></main>;
}
