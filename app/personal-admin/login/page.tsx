"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";

type Enrollment = { accessToken: string; email: string };

export default function PersonalAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) {
      setNotice(error?.message || "Unable to sign in.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/personal-admin", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const result = await response.json().catch(() => null) as { personalAdmin?: unknown; error?: string } | null;
    if (!response.ok) {
      await supabase.auth.signOut();
      setNotice(result?.error || "Unable to check Personal Admin access.");
      setSubmitting(false);
      return;
    }
    if (!result?.personalAdmin) {
      setEnrollment({ accessToken: data.session.access_token, email: data.session.user.email || email.trim() });
      setNotice("This authenticated account does not yet have a Personal Admin application. Complete the form below to submit one for Super Admin approval.");
      setSubmitting(false);
      return;
    }
    router.replace("/personal-admin/dashboard");
  }

  async function submitEnrollment(event: FormEvent) {
    event.preventDefault();
    if (!enrollment || submitting) return;
    setNotice("");
    setSubmitting(true);
    const response = await fetch("/api/personal-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${enrollment.accessToken}` },
      body: JSON.stringify({ fullName, phone }),
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) {
      setNotice(result?.error || "Unable to submit the Personal Admin application.");
      setSubmitting(false);
      return;
    }
    router.replace("/personal-admin/dashboard");
  }

  return <main className="bank-shell min-h-screen p-6 text-white"><section className="mx-auto max-w-md bank-surface rounded-xl p-8"><p className="text-xs font-black uppercase tracking-[.2em] text-green-400">Aurex Partner Operations</p><h1 className="mt-3 text-3xl font-black">Personal Admin sign in</h1><p className="mt-3 text-sm text-zinc-400">Use the email and password for your Personal Admin account. Pending accounts can sign in but cannot access customer data until approved.</p><form onSubmit={submit}><label className="mt-5 block text-sm">Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-3" /></label><label className="mt-4 block text-sm">Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-3" /></label><button disabled={submitting} className="mt-6 w-full rounded-lg bg-green-400 py-3 font-black text-black disabled:opacity-50">{submitting ? "Signing in…" : "Sign in as Personal Admin"}</button></form>{notice && <p role="status" className="mt-4 text-sm text-zinc-300">{notice}</p>}{enrollment && <form onSubmit={submitEnrollment} className="mt-6 border-t border-white/10 pt-6"><h2 className="text-lg font-black">Complete Personal Admin application</h2><p className="mt-2 text-sm text-zinc-400">Application for {enrollment.email}. This creates a pending application only; a Super Admin must approve it.</p><label className="mt-4 block text-sm">Full name<input required value={fullName} onChange={event => setFullName(event.target.value)} maxLength={120} className="mt-1 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-3" /></label><label className="mt-4 block text-sm">Phone<input required type="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={40} className="mt-1 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-3" /></label><button disabled={submitting} className="mt-5 w-full rounded-lg bg-green-400 py-3 font-black text-black disabled:opacity-50">{submitting ? "Submitting…" : "Submit Personal Admin application"}</button></form>}<p className="mt-5 text-sm text-zinc-400">Need a new account? <Link className="font-bold text-green-300" href="/personal-admin/register">Register as a Personal Admin</Link></p></section></main>;
}
