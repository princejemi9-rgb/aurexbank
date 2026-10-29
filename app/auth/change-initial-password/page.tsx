"use client";

import { FormEvent, useMemo, useState } from "react";
import { supabase } from "../../../src/lib/supabase";
import AurexBrand from "../../../src/components/brand/AurexBrand";

export default function ChangeInitialPasswordPage() {
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const valid = useMemo(() => password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && password === confirm, [password, confirm]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return; setError("");
    if (!valid) return setError("Use at least 10 characters including uppercase, lowercase, and a number. Passwords must match.");
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Your session has expired. Please sign in again."); setBusy(false); return; }
    const response = await fetch("/api/auth/complete-initial-password", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ password }) }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok || !result?.ok) { setError(result?.error || "Unable to complete account setup."); setBusy(false); return; }
    setPassword(""); setConfirm(""); window.location.replace("/dashboard");
  };
  return <main className="bank-shell flex min-h-screen items-center justify-center p-4 text-white"><section className="bank-surface w-full max-w-md rounded-xl p-6 sm:p-8"><AurexBrand titleClassName="text-2xl" /><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-green-400">First sign-in security</p><h1 className="mt-3 text-3xl font-black">Choose your personal password</h1><p className="mt-3 text-sm text-zinc-400">For your protection, replace the initial password provided by your Personal Admin before opening your account.</p><form onSubmit={submit} className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-bold">New password<input required type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" className="rounded-lg border border-white/10 bg-black/20 p-3 outline-none focus:border-green-400" /></label><label className="grid gap-2 text-sm font-bold">Confirm new password<input required type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" className="rounded-lg border border-white/10 bg-black/20 p-3 outline-none focus:border-green-400" /></label>{error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</p>}<button disabled={busy || !valid} className="rounded-lg bg-green-400 px-4 py-3 font-black text-black disabled:opacity-60">{busy ? "Securing account…" : "Save password and continue"}</button></form></section></main>;
}
