"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AurexBrand from "../../../src/components/brand/AurexBrand";
import { supabase } from "../../../src/lib/supabase";

export default function SecurityVerifyPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function redirectVerifiedAdmin() {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return;
      const response = await fetch("/api/auth/security-status", { credentials: "include", headers: { Authorization: `Bearer ${data.session.access_token}` } }).catch(() => null);
      const status = (await response?.json().catch(() => null)) as { verified?: boolean; bypassed?: boolean } | null;
      if (mounted && status?.verified && status.bypassed) router.replace("/dashboard");
    }
    void redirectVerifiedAdmin();
    return () => { mounted = false; };
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) { router.replace("/login"); return; }
    const response = await fetch("/api/auth/security-verify", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ passcode }) }).catch(() => null);
    const result = (await response?.json().catch(() => null)) as { error?: string } | null;
    if (!response?.ok) { setError(result?.error || "Security verification is unavailable. Please try again."); setLoading(false); return; }
    window.location.replace("/dashboard");
  }

  async function cancel() {
    await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear" }) }).catch(() => {});
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return <main className="min-h-dvh bg-[var(--brand-background)] px-4 py-5 text-white sm:p-8"><div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-md items-center"><section className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-2xl sm:p-8"><AurexBrand markClassName="h-12 w-12 rounded-lg" titleClassName="text-3xl" taglineClassName="text-[11px]" /><p className="mt-10 text-xs font-semibold uppercase tracking-[0.25em] text-green-400">Aurex Secure</p><h1 className="mt-4 text-4xl font-black tracking-tight">Security verification</h1><p className="mt-3 text-sm leading-relaxed text-zinc-400">Enter the separate security passcode provided by your Aurex administrator to complete sign-in.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-medium text-zinc-300">Aurex security passcode<input autoFocus autoComplete="one-time-code" type={visible ? "text" : "password"} value={passcode} onChange={(event) => setPasscode(event.target.value)} className="mt-2 h-14 w-full rounded-lg border border-white/10 bg-black/30 px-4 outline-none transition focus:border-green-400" placeholder="Enter security passcode" required /></label><label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-400"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="h-4 w-4 rounded border-white/20 bg-black/30" />Show passcode</label>{error && <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}<button disabled={loading} className="h-14 w-full rounded-lg bg-green-400 text-lg font-black text-black transition hover:bg-green-300 disabled:opacity-50">{loading ? "Verifying..." : "Verify and continue"}</button><button type="button" onClick={cancel} disabled={loading} className="w-full py-2 text-sm font-semibold text-zinc-400 transition hover:text-white">Back to sign in</button></form></section></div></main>;
}
