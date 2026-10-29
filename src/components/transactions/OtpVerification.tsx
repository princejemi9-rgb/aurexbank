"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Challenge = { id: string; purpose: string; status: string; expires_at: string };
export default function OtpVerification() {
  const [items, setItems] = useState<Challenge[]>([]); const [selected, setSelected] = useState(""); const [code, setCode] = useState(""); const [notice, setNotice] = useState("");
  async function auth() { const { data: { session } } = await supabase.auth.getSession(); return session ? { Authorization: `Bearer ${session.access_token}` } : null; }
  async function load() { const headers = await auth(); if (!headers) return; const response = await fetch("/api/otp", { headers, cache: "no-store" }); const result = await response.json(); if (result.ok) { const open = (result.challenges || []).filter((item: Challenge) => item.status === "open"); setItems(open); setSelected(open[0]?.id || ""); } }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); const headers = await auth(); if (!headers) return setNotice("Sign in required."); const response = await fetch("/api/otp", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: selected, code }) }); const result = await response.json(); setNotice(result.ok ? "Code verified successfully." : result.error || "Unable to verify code."); if (result.ok) { setCode(""); await load(); } }
  return <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-xl font-black">Verify a one-time passcode</h2><p className="mt-2 text-sm text-zinc-400">Enter a code issued by your assigned Personal Admin. Codes expire after 10 minutes.</p>{notice && <p role="status" className="mt-3 rounded bg-white/5 p-3 text-sm">{notice}</p>}{items.length ? <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2"><select value={selected} onChange={event => setSelected(event.target.value)} className="rounded-lg bg-white/10 p-3">{items.map(item => <option className="text-black" value={item.id} key={item.id}>{item.purpose.replaceAll("_", " ")} · expires {new Date(item.expires_at).toLocaleTimeString()}</option>)}</select><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} placeholder="Six-digit code" className="rounded-lg bg-white/10 p-3" /><button className="rounded-lg bg-green-400 px-4 py-3 font-black text-black sm:col-span-2">Verify code</button></form> : <p className="mt-4 text-sm text-zinc-400">No active one-time passcodes.</p>}</section>;
}
