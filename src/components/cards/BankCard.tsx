"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getAccountExperience } from "../../lib/accountExperience";
import { createCardPreview } from "../../lib/cardPreview";
import { AurexMark } from "../brand/AurexBrand";
import AppIcon from "../ui/AppIcon";
import { useBranding } from "../../context/BrandingContext";
import { useBanking } from "../../context/BankingContext";
import { createCardDetails } from "../../lib/cardDetails";
import { getCardPreferencesServerSnapshot, getCardPreferencesSnapshot, saveCardPreferences, setCardPreferencesAccount, subscribeCardPreferences } from "../../lib/cardPreferences";

export default function BankCard({ compact = false }: { compact?: boolean }) {
  const { currentProfile } = useBanking();
  return getAccountExperience(currentProfile.email).previewCard ? <DigitalCard compact={compact} /> : <LegacyBankCard compact={compact} />;
}

function CardFace({ card, branding, back }: { card: { number: string; expiry: string; holder: string; status: string }; branding: { bankName: string }; back: boolean }) {
  return <div className="relative min-h-[236px] overflow-hidden rounded-2xl border border-emerald-200/30 bg-gradient-to-br from-zinc-950 via-emerald-950 to-black p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:p-6">
    <span className="absolute -right-10 -top-16 size-52 rounded-full bg-green-300/15 blur-3xl" />
    {!back ? <div className="relative flex min-h-[188px] flex-col"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><AurexMark className="size-8 rounded-md border-white/20 bg-white/10" imageClassName="p-1" label={branding.bankName} /><div><p className="font-serif text-base font-bold">{branding.bankName}</p><p className="text-[9px] font-bold uppercase tracking-[.18em] text-white/55">Debit</p></div></div><div className="flex items-center gap-1"><span className="size-6 rounded-full bg-red-500" /><span className="-ml-3 size-6 rounded-full bg-amber-400/95 mix-blend-screen" /><span className="ml-1 text-[9px] font-bold tracking-wide text-white/80">mastercard</span></div></div><div className="mt-7 flex size-10 items-center rounded-md border border-amber-100/40 bg-gradient-to-br from-amber-100 via-amber-400 to-amber-700"><span className="h-full w-1/3 border-r border-amber-800/40" /><span className="h-full w-1/3 border-r border-amber-800/40" /></div><p className="mt-5 font-mono text-lg font-medium tracking-[.12em] sm:text-xl">{card.number}</p><div className="mt-auto flex items-end justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-white/45">Cardholder</p><p className="mt-1 break-words text-sm font-bold uppercase tracking-[.08em]">{card.holder}</p></div><div className="text-right"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-white/45">Valid thru</p><p className="mt-1 text-sm font-bold">{card.expiry}</p></div></div></div> : <div className="relative flex min-h-[188px] flex-col"><div className="-mx-5 mt-4 h-11 bg-black sm:-mx-6" /><div className="mt-4 flex items-center gap-3"><div className="min-w-0 flex-1 rounded bg-white/90 px-3 py-2"><p className="truncate text-[10px] font-bold uppercase tracking-[.1em] text-zinc-700">{card.holder}</p><div className="mt-1 h-px bg-zinc-400" /></div><span className="rounded bg-white/90 px-2 py-2 font-mono text-sm font-bold tracking-[.16em] text-zinc-900">•••</span></div><div className="mt-4 text-[9px] leading-relaxed text-white/60"><p>Use of this card is subject to the cardholder agreement.</p><p className="mt-1">For cardholder service, visit {branding.bankName.toLowerCase()}.com.</p></div><div className="mt-auto flex items-center justify-between gap-3"><p className="text-[10px] uppercase tracking-[.16em] text-white/45">{branding.bankName}</p><div className="flex items-center gap-1"><span className="size-5 rounded-full bg-red-500" /><span className="-ml-2 size-5 rounded-full bg-amber-400/95 mix-blend-screen" /><span className="ml-1 text-[8px] font-bold tracking-wide text-white/80">mastercard</span></div></div></div>}
  </div>;
}

function DigitalCard({ compact }: { compact: boolean }) {
  const { currentProfile } = useBanking();
  const { branding } = useBranding();
  const card = createCardPreview(currentProfile.userId, currentProfile.fullName);
  const [back, setBack] = useState(false);
  const face = <CardFace card={card} branding={branding} back={back} />;
  return <div className={compact ? "w-full" : "max-w-xl"}>{compact ? <Link href="/cards" aria-label="Open card management" className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-green-300">{face}</Link> : face}{!compact && <><div className="mt-3"><button type="button" onClick={() => setBack(value => !value)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"><AppIcon name="card" className="size-4" />{back ? "View front" : "View back"}</button></div><dl className="mt-4 grid gap-3 sm:grid-cols-2">{[["Cardholder", card.holder], ["Bank", branding.bankName], ["Card number", card.number], ["Expiration", card.expiry], ["Security code", "•••"], ["Card type", card.status]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-white/10 p-3"><dt className="text-xs text-zinc-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl></>}</div>;
}

function LegacyBankCard({ compact = false }: { compact?: boolean }) {
  const { currentProfile } = useBanking(); const { branding } = useBranding(); const [revealed, setRevealed] = useState(false); const [back, setBack] = useState(false);
  setCardPreferencesAccount(currentProfile.userId);
  const preferences = useSyncExternalStore(subscribeCardPreferences, getCardPreferencesSnapshot, getCardPreferencesServerSnapshot);
  const card = createCardDetails(currentProfile.userId); const frozen = preferences.frozenCards.includes(card.id);
  const maskedNumber = `•••• •••• •••• ${card.number.slice(-4)}`;
  const changeFrozenState = () => saveCardPreferences({ ...preferences, frozenCards: frozen ? preferences.frozenCards.filter((id) => id !== card.id) : [...preferences.frozenCards, card.id] });
  const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10";
  return <div className={compact ? "w-full" : "max-w-xl"}><div className="relative min-h-[236px] overflow-hidden rounded-2xl border border-emerald-200/30 bg-gradient-to-br from-zinc-950 via-emerald-950 to-black p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:p-6"><div className="relative flex min-h-[188px] flex-col"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><AurexMark className="size-8 rounded-md border-white/20 bg-white/10" imageClassName="p-1" label={branding.bankName} /><p className="font-serif text-base font-bold">{branding.bankName}</p></div><span className="text-xs font-bold">Debit</span></div><p className="mt-16 font-mono text-lg">{revealed ? card.number : maskedNumber}</p><div className="mt-auto flex justify-between"><p className="font-bold uppercase">{currentProfile.fullName}</p><p>{card.expiry}</p></div>{frozen && <span className="absolute bottom-0 right-0 bg-amber-300 px-3 py-1 text-[10px] font-black uppercase text-black">Frozen</span>}</div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setRevealed(value => !value)} className={button}>{revealed ? "Hide details" : "View details"}</button><button type="button" onClick={changeFrozenState} className={button}>{frozen ? "Unfreeze card" : "Freeze card"}</button><button type="button" onClick={() => setBack(value => !value)} className={button}>{back ? "View front" : "View back"}</button></div></div>;
}
