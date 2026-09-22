"use client";

import { useSyncExternalStore } from "react";
import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import { AurexMark } from "../../src/components/brand/AurexBrand";
import AppIcon from "../../src/components/ui/AppIcon";
import { useBranding } from "../../src/context/BrandingContext";
import { useBanking } from "../../src/context/BankingContext";
import { createCardPreview } from "../../src/lib/cardPreview";
import { getCardPreferencesServerSnapshot, getCardPreferencesSnapshot, saveCardPreferences, setCardPreferencesAccount, subscribeCardPreferences } from "../../src/lib/cardPreferences";

export default function CardsPage() {
  const { currentProfile } = useBanking();
  const { branding } = useBranding();
  setCardPreferencesAccount(currentProfile.userId);
  const preferences = useSyncExternalStore(subscribeCardPreferences, getCardPreferencesSnapshot, getCardPreferencesServerSnapshot);
  const preview = createCardPreview(currentProfile.userId, currentProfile.fullName);
  const locked = preferences.frozenCards.includes(preview.id);
  const setLocked = () => saveCardPreferences({ ...preferences, frozenCards: locked ? preferences.frozenCards.filter(id => id !== preview.id) : [...preferences.frozenCards, preview.id] });
  const controls = [
    { title: locked ? "Unlock Preview" : "Lock Preview", description: "A local preview setting. It does not affect a payment card.", icon: "lock" as const, action: setLocked },
    { title: "Manage PIN", description: "Unavailable until an issuer connects secure PIN services.", icon: "card" as const },
    { title: "Report Lost or Stolen", description: "Contact support for issuer-backed lost-card reporting.", icon: "shield" as const },
    { title: "Card Settings", description: "Preview notifications are stored only for this account on this device.", icon: "activity" as const, action: () => saveCardPreferences({ ...preferences, onlineEnabled: !preferences.onlineEnabled }) },
  ] as const;
  return <main className="bank-shell min-h-screen overflow-x-hidden text-white"><DesktopSidebar /><div className="app-content desktop-page-content"><div className="app-inner"><section className="bank-surface rounded-xl p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">Card services</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Debit Card</h1><p className="mt-2 text-sm text-zinc-400">A personalized {branding.bankName} debit-card preview for your account.</p></section><section className="relative mt-6 max-w-xl overflow-hidden rounded-2xl border border-green-300/20 bg-gradient-to-br from-zinc-950 via-emerald-950 to-black p-6 shadow-2xl sm:p-7"><span className="absolute -right-12 -top-20 size-64 rounded-full bg-green-300/10 blur-3xl" /><span className="absolute inset-0 opacity-30 [background-image:linear-gradient(125deg,transparent_20%,rgba(255,255,255,.08)_20.5%,transparent_21%,transparent_48%,rgba(16,185,129,.16)_48.5%,transparent_49%)]" /><div className="relative"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><AurexMark className="size-10 rounded-lg border-white/20 bg-white/10" imageClassName="p-1.5" label={branding.bankName} /><div><p className="font-serif text-xl font-bold">{branding.bankName}</p><p className="text-[10px] uppercase tracking-[0.18em] text-white/55">Private banking</p></div></div><span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/75">Preview</span></div><p className="mt-10 text-2xl font-semibold tracking-[0.12em]">{preview.identifier}</p><div className="mt-8 flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Cardholder</p><p className="mt-1 font-bold uppercase tracking-[0.08em]">{preview.holder}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Status</p><p className="mt-1 font-bold">{locked ? "Preview locked" : "Preview active"}</p></div></div></div></section><p className="mt-3 text-xs text-zinc-500">Preview only. It has no payment credentials and cannot make payments.</p><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{controls.map(control => <button key={control.title} type="button" onClick={control.action} disabled={!control.action} className="bank-surface rounded-xl p-5 text-left enabled:transition enabled:hover:border-green-300/35 disabled:cursor-not-allowed disabled:opacity-70"><span className="grid size-10 place-items-center rounded-lg bg-green-400/10 text-green-300"><AppIcon name={control.icon} className="size-5" /></span><h2 className="mt-4 font-black">{control.title}</h2><p className="mt-2 text-sm leading-relaxed text-zinc-500">{control.description}</p></button>)}</section><section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/5 text-zinc-300"><AppIcon name="card" className="size-5" /></span><div><h2 className="font-black">Add to Mobile Wallet</h2><p className="mt-2 text-sm text-zinc-500">Unavailable until issuer provisioning is integrated.</p></div></div></section></div></div><BottomNav /></main>;
}
