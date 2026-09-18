"use client";

import Link from "next/link";

export default function UpcomingPayments() {
  return <section className="bank-surface rounded-lg p-5"><p className="text-sm font-semibold text-green-400">Everyday payments</p><h2 className="mt-2 text-2xl font-black">Keep your essentials together</h2><p className="mt-3 text-sm leading-relaxed text-zinc-400">Explore bill payments, send money, and review your transfer history. Check each payment confirmation for its status.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/payments" className="rounded-lg bg-green-400 p-4 text-center text-sm font-bold text-black">Explore bill payments</Link><Link href="/send" className="rounded-lg border border-white/15 p-4 text-center text-sm font-bold text-green-300">Transfers & history</Link></div></section>;
}
