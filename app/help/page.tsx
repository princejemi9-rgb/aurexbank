"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";

const helpSections = [
  {
    title: "Transfers & Payments",
    description: "International wires, local bank transfers, pending transactions, and failed payments.",
    icon: "send" as const,
    href: "/send",
    articles: ["Transfer limits", "Payment status", "Failed payment review"],
  },
  {
    title: "Cards & Limits",
    description: "Freeze cards, spending controls, virtual cards, and withdrawal limits.",
    icon: "card" as const,
    href: "/cards",
    articles: ["Freeze a card", "Change limits", "Virtual card security"],
  },
  {
    title: "Security & Privacy",
    description: "Passwords, suspicious logins, device management, and biometric security.",
    icon: "shield" as const,
    href: "/settings",
    articles: ["Trusted devices", "Password changes", "Biometric approval"],
  },
  {
    title: "Crypto Assets",
    description: "Crypto portfolio monitoring, wallet security, and digital asset transfers.",
    icon: "crypto" as const,
    href: "/receive",
    articles: ["Wallet deposits", "Network fees", "Asset confirmation"],
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return helpSections;

    return helpSections.filter((section) =>
      [section.title, section.description, ...section.articles]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query]);

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-[16.25rem]">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                Aurex Bank Assistance Center
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Help Center
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Find guidance for transfers, account security, digital assets, cards, and premium banking services.
            </p>
          </section>

          <section className="bank-surface rounded-lg p-5">
            <div className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3">
              <AppIcon name="search" className="h-5 w-5 shrink-0 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search banking support topics..."
                className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-zinc-600"
              />
            </div>
          </section>

          <section className="mt-6 grid min-w-0 gap-6 md:grid-cols-2">
            {filteredSections.map((section) => (
              <div
                key={section.title}
                className="bank-surface rounded-lg p-6 transition-all hover:bg-white/[0.055]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                  <AppIcon name={section.icon} className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-3xl font-black leading-tight">{section.title}</h2>
                <p className="mt-3 leading-relaxed text-zinc-500">{section.description}</p>

                <div className="mt-5 space-y-2">
                  {section.articles.map((article) => (
                    <div
                      key={article}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3"
                    >
                      <span className="h-2 w-2 rounded-full bg-green-400" />
                      <p className="text-sm font-semibold text-zinc-300">{article}</p>
                    </div>
                  ))}
                </div>

                <Link
                  href={section.href}
                  className="mt-6 inline-flex rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black transition-all hover:bg-green-300"
                >
                  Open Guide
                </Link>
              </div>
            ))}
          </section>

          <section className="mt-6 rounded-lg border border-green-300/15 bg-green-400/[0.07] p-6 lg:p-8">
            <p className="text-sm font-semibold text-green-400">Premium Banking Support</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">Need More Assistance?</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">
              Aurex Black members receive priority support with dedicated banking specialists and faster issue resolution.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/support"
                className="rounded-lg bg-green-400 px-6 py-4 text-sm font-black text-black transition-all hover:bg-green-300"
              >
                Open Live Support
              </Link>
              <Link
                href="/notifications"
                className="bank-button rounded-lg px-6 py-4 text-sm font-black"
              >
                View Service Alerts
              </Link>
            </div>
          </section>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
