"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import { AurexMark } from "../../src/components/brand/AurexBrand";
import AppIcon from "../../src/components/ui/AppIcon";
import { useBranding } from "../../src/context/BrandingContext";
import { useBanking } from "../../src/context/BankingContext";
import { supabase } from "../../src/lib/supabase";

type CardRecord = { card_number: string; username: string; expiry?: string | null };
const lastFour = (value: string) => value.replace(/\D/g, "").slice(-4);

export default function CardsPage() {
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
    const channel = supabase.channel(`card-services-${channelId}`).on("postgres_changes", { event: "*", schema: "public", table: "cards" }, () => void loadCard()).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [channelId, currentProfile.username]);

  const actionItems = [
    ["Lock Card", "Card locking is not available for this card record.", "lock" as const],
    ["Manage PIN", "PIN management requires issuer support.", "card" as const],
    ["Report Lost or Stolen", "Contact support to report a card.", "shield" as const],
    ["Card Settings", "Issuer-backed settings are not available.", "activity" as const],
  ] as const;

  return <main className="bank-shell min-h-screen overflow-x-hidden text-white"><DesktopSidebar /><div className="app-content desktop-page-content"><div className="app-inner"><section className="bank-surface rounded-xl p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">Card services</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Debit Card</h1><p className="mt-2 text-sm text-zinc-400">Your issued Aurex debit card and supported services.</p></section>{card ? <><section className="relative mt-6 overflow-hidden rounded-2xl border border-green-300/20 bg-gradient-to-br from-zinc-950 via-emerald-950 to-black p-6 shadow-2xl sm:max-w-xl sm:p-7"><span className="absolute -right-12 -top-20 size-64 rounded-full bg-green-300/10 blur-3xl" /><span className="absolute inset-0 opacity-30 [background-image:linear-gradient(125deg,transparent_20%,rgba(255,255,255,.08)_20.5%,transparent_21%,transparent_48%,rgba(16,185,129,.16)_48.5%,transparent_49%)]" /><div className="relative"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><AurexMark className="size-10 rounded-lg border-white/20 bg-white/10" imageClassName="p-1.5" label={branding.bankName} /><div><p className="font-serif text-xl font-bold">{branding.bankName}</p><p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Private banking</p></div></div><span className="text-sm text-white/70">Debit</span></div><p className="mt-10 text-2xl font-semibold tracking-[0.16em]">•••• •••• •••• {lastFour(card.card_number)}</p><div className="mt-8 flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Cardholder</p><p className="mt-1 font-bold uppercase tracking-[0.08em]">{currentProfile.fullName}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Expires</p><p className="mt-1 font-bold">{card.expiry || "On file"}</p></div></div></div></section><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{actionItems.map(([title, description, icon]) => <div key={title} className="bank-surface rounded-xl p-5"><span className="grid size-10 place-items-center rounded-lg bg-green-400/10 text-green-300"><AppIcon name={icon} className="size-5" /></span><h2 className="mt-4 font-black">{title}</h2><p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p></div>)}</section><section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-black">Add to Mobile Wallet</h2><p className="mt-2 text-sm text-zinc-500">Mobile-wallet provisioning is not available for this card record.</p></section></> : <section className="bank-surface mt-6 rounded-xl p-6"><h2 className="text-xl font-black">No card issued</h2><p className="mt-2 text-sm text-zinc-500">A debit card will appear here when a card issuer has created a record for your account.</p><Link href="/support" className="mt-4 inline-flex font-bold text-green-300">Contact support &rarr;</Link></section>}</div></div><BottomNav /></main>;
}
