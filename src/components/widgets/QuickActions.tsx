"use client";

import Link from "next/link";

import AppIcon from "../ui/AppIcon";

export default function QuickActions() {
  const actions = [
    { title: "Send Money", subtitle: "Bank, wire, crypto", icon: "send" as const, href: "/send" },
    { title: "Receive", subtitle: "Accounts and QR", icon: "receive" as const, href: "/receive" },
    { title: "Cards", subtitle: "Limits and controls", icon: "card" as const, href: "/cards" },
    { title: "Crypto", subtitle: "Wallet and assets", icon: "crypto" as const, href: "/receive" },
  ];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Core banking tools</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Quick Access</h2>
        </div>
        <button className="bank-button rounded-lg px-4 py-2.5 text-sm font-semibold">
          Customize
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="bank-surface group rounded-lg p-4 transition-all hover:-translate-y-0.5 hover:border-white/15"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/[0.06] text-green-300">
              <AppIcon name={action.icon} className="h-5 w-5" />
            </div>
            <h3 className="mt-4 truncate text-base font-black">{action.title}</h3>
            <p className="mt-1 truncate text-sm text-zinc-500">{action.subtitle}</p>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-green-400">
                Ready
              </span>
              <span className="text-sm font-black text-zinc-500">-&gt;</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
