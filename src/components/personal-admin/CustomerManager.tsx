"use client";
/* eslint-disable @next/next/no-img-element -- customer avatars use the configured Supabase Storage URL at runtime. */

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import SignOutButton from "../auth/SignOutButton";

type Customer = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  country: string;
  account_type: "personal" | "business";
  address: string;
  avatar_url?: string | null;
  balance: number;
  currency: string;
  account_status: "active" | "suspended";
};
type Activity = { id: string; action: string; created_at: string; metadata?: Record<string, unknown> };

export default function CustomerManager({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const authorization = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : null;
  }, []);

  const load = useCallback(async () => {
    const headers = await authorization();
    if (!headers) return setNotice("Sign in as the assigned Personal Admin to manage this customer.");
    const response = await fetch(`/api/personal-admin/customers/${customerId}`, { headers, cache: "no-store" });
    const result = await response.json();
    if (!result.ok) return setNotice(result.error || "Unable to load customer.");
    setCustomer(result.customer);
    setActivity(result.activity || []);
  }, [authorization, customerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer || saving) return;
    setSaving(true); setNotice("");
    try {
      const headers = await authorization();
      if (!headers) throw new Error("Sign in required.");
      const response = await fetch(`/api/personal-admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: customer.full_name, phone: customer.phone, country: customer.country, accountType: customer.account_type, address: customer.address, accountStatus: customer.account_status }),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "Unable to save customer.");
      setNotice("Customer details and account status were updated and recorded in the audit trail.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save customer."); }
    finally { setSaving(false); }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;
    setUploading(true); setNotice("");
    try {
      const headers = await authorization();
      if (!headers) throw new Error("Sign in required.");
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/personal-admin/customers/${customerId}/avatar`, { method: "POST", headers, body: form });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || "Unable to upload profile photo.");
      setNotice("Customer profile photo updated and recorded in the audit trail.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to upload profile photo."); }
    finally { setUploading(false); }
  }

  return <main className="bank-shell min-h-screen p-4 text-white sm:p-8"><div className="mx-auto max-w-3xl">
    <header className="bank-surface rounded-xl p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-green-400">Personal Admin</p><h1 className="mt-2 text-3xl font-black">Customer management</h1><p className="mt-2 text-sm text-zinc-400">Only customers assigned to your portfolio can be managed here.</p></div><SignOutButton className="w-full sm:w-auto" /></div></header>
    <Link className="bank-button mt-4 inline-block rounded-lg px-3 py-2 text-sm font-bold" href="/personal-admin/customers">Back to customers</Link>
    {notice && <p className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm" role="status">{notice}</p>}
    {customer && <><section className="bank-surface mt-5 rounded-xl p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="h-20 w-20 overflow-hidden rounded-full bg-white/10">{customer.avatar_url ? <img src={customer.avatar_url} alt="Customer profile" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xl font-black">{customer.full_name.slice(0, 1).toUpperCase()}</div>}</div><div className="min-w-0 flex-1"><p className="font-black">{customer.full_name}</p><p className="break-all text-sm text-zinc-400">{customer.email}</p><p className="mt-1 text-sm font-bold">{customer.currency} {Number(customer.balance).toLocaleString()}</p></div><label className="bank-button cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-bold">{uploading ? "Uploading…" : "Upload photo"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={uploadAvatar} disabled={uploading} /></label></div></section>
    <form onSubmit={save} className="bank-surface mt-5 grid gap-4 rounded-xl p-5 sm:grid-cols-2"><label>Full name<input required value={customer.full_name} onChange={event => setCustomer({ ...customer, full_name: event.target.value })} className="mt-1 w-full rounded bg-white/10 p-3" /></label><label>Phone<input value={customer.phone} onChange={event => setCustomer({ ...customer, phone: event.target.value })} className="mt-1 w-full rounded bg-white/10 p-3" /></label><label>Country<input value={customer.country} onChange={event => setCustomer({ ...customer, country: event.target.value })} className="mt-1 w-full rounded bg-white/10 p-3" /></label><label>Account type<select value={customer.account_type} onChange={event => setCustomer({ ...customer, account_type: event.target.value as Customer["account_type"] })} className="mt-1 w-full rounded bg-white/10 p-3"><option className="text-black" value="personal">Personal</option><option className="text-black" value="business">Business</option></select></label><label>Status<select value={customer.account_status} onChange={event => setCustomer({ ...customer, account_status: event.target.value as Customer["account_status"] })} className="mt-1 w-full rounded bg-white/10 p-3"><option className="text-black" value="active">Active</option><option className="text-black" value="suspended">Suspended</option></select></label><label className="sm:col-span-2">Address<textarea value={customer.address || ""} onChange={event => setCustomer({ ...customer, address: event.target.value })} className="mt-1 min-h-24 w-full rounded bg-white/10 p-3" /></label><button disabled={saving} className="rounded bg-green-400 px-4 py-3 font-black text-black disabled:opacity-50 sm:col-span-2">{saving ? "Saving…" : "Save customer changes"}</button></form>
    <section className="bank-surface mt-5 rounded-xl p-5"><h2 className="font-black">Password recovery</h2><p className="mt-2 text-sm text-zinc-400">For account security, a Personal Admin cannot view or set a customer password. Direct the customer to the existing secure password-recovery flow.</p><Link href="/auth/forgot-password" className="bank-button mt-3 inline-block rounded-lg px-3 py-2 text-sm font-bold">Open secure recovery</Link></section>
    <section className="bank-surface mt-5 rounded-xl p-5"><h2 className="font-black">Customer activity</h2>{activity.length ? activity.map(item => <article key={item.id} className="mt-3 rounded bg-white/5 p-3 text-sm"><p className="font-bold">{item.action.replaceAll("_", " ")}</p><p className="mt-1 text-zinc-400">{new Date(item.created_at).toLocaleString()}</p></article>) : <p className="mt-3 text-sm text-zinc-400">No lifecycle activity recorded yet.</p>}</section></>}
  </div></main>;
}
