"use client";

import Link from "next/link";
import { AurexMark } from "../brand/AurexBrand";
import { useBranding } from "../../context/BrandingContext";
import { useBanking } from "../../context/BankingContext";
import { createCardPreview } from "../../lib/cardPreview";

export default function LiveCard() {
  const { currentProfile } = useBanking();
  const { branding } = useBranding();
  const preview = createCardPreview(currentProfile.userId, currentProfile.fullName);
  return <Link href="/cards" aria-label="Open Aurex debit card preview" className="group relative block overflow-hidden rounded-2xl border border-green-300/20 bg-gradient-to-br from-zinc-950 via-emerald-950 to-black p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] transition hover:-translate-y-0.5 hover:border-green-300/45 sm:p-6"><span className="absolute -right-10 -top-16 size-52 rounded-full bg-green-300/10 blur-3xl" /><span className="absolute inset-0 opacity-30 [background-image:linear-gradient(125deg,transparent_20%,rgba(255,255,255,.08)_20.5%,transparent_21%,transparent_48%,rgba(16,185,129,.16)_48.5%,transparent_49%)]" /><div className="relative"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><AurexMark className="size-9 rounded-lg border-white/20 bg-white/10" imageClassName="p-1.5" label={branding.bankName} /><div><p className="font-serif text-lg font-bold text-white">{branding.bankName}</p><p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Debit card preview</p></div></div><span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/75">Preview</span></div><p className="mt-9 text-xl font-semibold tracking-[0.12em] text-white sm:text-2xl">{preview.identifier}</p><div className="mt-7 flex items-end justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Cardholder</p><p className="mt-1 truncate text-sm font-bold uppercase tracking-[0.08em] text-white">{preview.holder}</p></div><p className="text-xs text-white/50">Not a payment card</p></div></div></Link>;
}
