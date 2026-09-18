"use client";

import Link from "next/link";
import { useBanking } from "../../context/BankingContext";

export default function AccountOverview() {
  const { currentProfile, verificationStatus, accountStatus, transferFrozen, transactions, unreadCount } = useBanking();
  const items = [
    { title: "Your profile", detail: "Keep your contact details current so you can receive account updates.", href: "/profile", action: "Review profile" },
    { title: "Receive money", detail: "Find your account details and available ways to fund your account.", href: "/receive", action: "View deposit details" },
    { title: "Cards & payments", detail: "Manage your cards and explore payment options in one place.", href: "/cards", action: "Manage cards" },
    { title: "Help when you need it", detail: "Get help with verification, transfers, or access to your account.", href: "/support", action: "Contact support" },
  ];
  return <section className="mt-6 rounded-2xl border border-green-300/15 bg-green-400/[0.04] p-5 sm:p-6" aria-labelledby="account-overview-title">
    <p className="text-xs font-bold uppercase tracking-widest text-green-300">Your banking essentials</p>
    <h2 id="account-overview-title" className="mt-2 text-2xl font-black">{transactions.length ? "Stay on top of your account" : "Make yourself at home"}</h2>
    <p className="mt-2 text-sm text-zinc-400">{transactions.length ? "Review your account status and choose what to do next." : "Your account starts with a clean slate. Explore your details, cards, and support while you get set up."}</p>
    <dl className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["Account", accountStatus], ["Identity review", verificationStatus], ["Transfers", transferFrozen ? "Frozen" : "Not frozen"], ["Notifications", `${unreadCount} unread`]].map(([label, value]) => <div key={label} className="rounded-lg bg-black/20 p-3"><dt className="text-xs text-zinc-400">{label}</dt><dd className="mt-1 text-sm font-bold capitalize">{value}</dd></div>)}
    </dl>
    {verificationStatus !== "approved" && <p className="mb-5 text-sm text-amber-200">Identity review: {verificationStatus}. Contact support if you need help completing verification.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(item => <Link key={item.href} href={item.href} className="rounded-xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-green-300/40 focus-visible:outline-2 focus-visible:outline-green-300"><h3 className="font-bold">{item.title}</h3><p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.detail}</p><span className="mt-4 block text-sm font-bold text-green-300">{item.action} &rarr;</span></Link>)}</div>
    <p className="mt-4 break-all text-xs text-zinc-500">Account reference: {currentProfile.customerId}</p>
  </section>;
}
