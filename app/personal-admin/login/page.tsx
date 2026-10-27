"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";

export default function PersonalAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setNotice(""); setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) { setNotice(error?.message || "Unable to sign in."); setSubmitting(false); return; }
    const response = await fetch("/api/personal-admin", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
    const result = await response.json().catch(() => null) as { personalAdmin?: unknown; error?: string } | null;
    if (!response.ok || !result?.personalAdmin) {
      await supabase.auth.signOut();
      setNotice(result?.error || "This account is not registered as a Personal Admin. Register first or use customer sign in.");
      setSubmitting(false);
      return;
    }
    router.replace("/personal-admin/dashboard");
  }

  return <main className="bank-shell min-h-screen p-6 text-white"><form onSubmit={submit} className="mx-auto max-w-md bank-surface rounded-xl p-8"><p className="text-xs font-black uppercase tracking-[.2em] text-green-400">Aurex Partner Operations</p><h1 className="mt-3 text-3xl font-black">Personal Admin sign in</h1><p className="mt-3 text-sm text-zinc-400">Use the email and password for your Personal Admin account. Pending accounts can sign in but cannot access customer data until approved.</p><label className="mt-5 block text-sm">Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-3" /></label><label className="mt-4 block text-sm">Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-3" /></label><button disabled={submitting} className="mt-6 w-full rounded-lg bg-green-400 py-3 font-black text-black disabled:opacity-50">{submitting ? "Signing in…" : "Sign in as Personal Admin"}</button>{notice && <p className="mt-4 text-sm text-zinc-300">{notice}</p>}<p className="mt-5 text-sm text-zinc-400">Need an account? <Link className="font-bold text-green-300" href="/personal-admin/register">Register as a Personal Admin</Link></p></form></main>;
}
