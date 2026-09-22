"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import { supabase } from "../../lib/supabase";
import { useBranding } from "../../context/BrandingContext";
import { useBanking } from "../../context/BankingContext";
import { AurexMark } from "../brand/AurexBrand";

type CardRecord = { card_number: string; username: string; expiry?: string | null };
const lastFour = (value: string) => value.replace(/\D/g, "").slice(-4);

export default function LiveCard() {
  const { currentProfile } = useBanking();
  const { branding } = useBranding();
  const channelId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [card, setCard] = useState<CardRecord | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("cards").select("card_number, username, expiry").eq("username", currentProfile.username).limit(1);
      if (active) setCard(data?.[0] ?? null);
    }
    void loadCard();
    const channel = supabase.channel(`card-preview-${channelId}`).on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () => void loadCard()).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [channelId, currentProfile.username]);

  if (!card) return <section className="bank-surface rounded-xl p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-green-400">Debit card</p><h2 className="mt-2 text-xl font-black">No card issued</h2><p className="mt-2 text-sm text-zinc-500">Your issued card will appear here when it is available.</p><Link href="/cards" className="mt-4 inline-flex text-sm font-bold text-green-300">View card services &rarr;</Link></section>;

  return <Link href="/cards" aria-label="Open debit card services" className="group relative block overflow-hidden rounded-2xl border border-green-300/20 bg-gradient-to-br from-zinc-950 via-emerald-950 to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] transition hover:-translate-y-0.5 hover:border-green-300/45 sm:p-6">
    <span className="absolute -right-10 -top-16 size-52 rounded-full bg-green-300/10 blur-3xl" />
    <span className="absolute inset-0 opacity-30 [background-image:linear-gradient(125deg,transparent_20%,rgba(255,255,255,.08)_20.5%,transparent_21%,transparent_48%,rgba(16,185,129,.16)_48.5%,transparent_49%)]" />
    <div className="relative"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><AurexMark className="size-9 rounded-lg border-white/20 bg-white/10" imageClassName="p-1.5" label={branding.bankName} /><div><p className="font-serif text-lg font-bold text-white">{branding.bankName}</p><p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Debit card</p></div></div><span className="text-xs font-semibold text-white/70">Debit</span></div><p className="mt-9 text-xl font-semibold tracking-[0.16em] text-white sm:text-2xl">•••• •••• •••• {lastFour(card.card_number)}</p><div className="mt-7 flex items-end justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Cardholder</p><p className="mt-1 truncate text-sm font-bold uppercase tracking-[0.08em] text-white">{currentProfile.fullName}</p></div><div className="text-right"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Expiry</p><p className="mt-1 text-sm font-bold text-white">{card.expiry || "On file"}</p></div></div></div>
  </Link>;
}
