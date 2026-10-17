"use client";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import BankCard from "../../src/components/cards/BankCard";
import { useBranding } from "../../src/context/BrandingContext";
import { useBanking } from "../../src/context/BankingContext";
import { PrivateAmount } from "../../src/components/ui/PrivateAmount";

export default function CardsPage() {
  const { branding } = useBranding();
  const { balance } = useBanking();
  return <main className="bank-shell min-h-screen overflow-x-hidden text-white"><DesktopSidebar /><div className="app-content desktop-page-content"><div className="app-inner"><section className="bank-surface rounded-xl p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">Card services</p><div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Your debit card</h1><p className="mt-2 text-sm text-zinc-400">Manage your {branding.bankName} virtual debit card.</p></div><div className="rounded-lg border border-green-300/20 bg-green-400/[0.07] px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-green-200">Available balance</p><p className="mt-1 text-xl font-black tabular-nums"><PrivateAmount value={balance} /></p></div></div></section><section className="mt-6"><BankCard /></section></div></div><BottomNav /></main>;
}

