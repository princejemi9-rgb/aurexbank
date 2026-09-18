"use client";

import Link from "next/link";
import { useBanking } from "../../context/BankingContext";

export default function AIInsights() {
  const { transactions, unreadCount, transferFrozen } = useBanking();
  const pending = transactions.filter(item => item.status.toLowerCase() === "pending").length;
  const insights = [
    { title: transactions.length ? `${transactions.length} recent transactions` : "Your activity starts here", detail: transactions.length ? `${pending} pending in your recent history. Review your payment activity and updates.` : "Payments and transfers will appear after you start using your account.", href: "/notifications" },
    { title: unreadCount ? `${unreadCount} unread notifications` : "No unread notifications", detail: "Review account messages and security updates in your notification center.", href: "/notifications" },
    { title: transferFrozen ? "Transfers are frozen" : "Plan your next payment", detail: transferFrozen ? "Contact support to understand the restriction on your account." : "Review recipient details and fees before sending money.", href: transferFrozen ? "/support" : "/send" },
  ];
  return <section className="bank-surface rounded-lg p-5"><p className="text-sm font-semibold text-green-400">Account insights</p><h2 className="mt-2 text-2xl font-black">What needs your attention</h2><div className="mt-5 space-y-3">{insights.map(item => <Link key={item.title} href={item.href} className="block rounded-lg border border-white/10 p-4 hover:bg-white/5"><h3 className="font-bold">{item.title}</h3><p className="mt-2 text-sm text-zinc-400">{item.detail}</p></Link>)}</div></section>;
}
