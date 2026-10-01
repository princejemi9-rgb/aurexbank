"use client";

import { useBanking } from "../../src/context/BankingContext";
import { getAccountExperience } from "../../src/lib/accountExperience";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import BankCard from "../../src/components/cards/BankCard";
import { useBranding } from "../../src/context/BrandingContext";

export default function CardsPage() {
  const { branding } = useBranding();
  const { currentProfile } = useBanking();
  const preview = getAccountExperience(currentProfile.email).previewCard;
  return <main className="bank-shell min-h-screen overflow-x-hidden text-white"><DesktopSidebar /><div className="app-content desktop-page-content"><div className="app-inner"><section className="bank-surface rounded-xl p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">Card services</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Your debit card</h1><p className="mt-2 text-sm text-zinc-400">{preview ? `View your ${branding.bankName} card preview.` : `Manage your ${branding.bankName} Mastercard debit card.`}</p></section><section className="mt-6"><BankCard /></section></div></div><BottomNav /></main>;
}

