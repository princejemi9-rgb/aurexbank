"use client";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AccountAccessSummary from "../../src/components/profile/AccountAccessSummary";

export default function Page() {
  return <main className="bank-shell min-h-screen overflow-x-hidden text-white">
    <DesktopSidebar />
    <div className="app-content desktop-page-content"><div className="app-inner">
      <section className="bank-surface rounded-lg p-6 lg:p-8">
        <p className="text-xs font-black uppercase tracking-widest text-green-400">Account security</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Devices & Sign-in</h1>
        <p className="mt-3 text-sm text-zinc-400">Review the sign-in information available for your account.</p>
        <AccountAccessSummary />
      </section>
    </div></div>
    <BottomNav />
  </main>;
}
