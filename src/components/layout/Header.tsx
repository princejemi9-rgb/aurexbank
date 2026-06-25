"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AurexMark } from "../brand/AurexBrand";
import AppIcon from "../ui/AppIcon";
import { useBanking } from "../../context/BankingContext";

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { alerts, currentProfile, transactions, unreadCount } = useBanking();
  const firstName = currentProfile.firstName;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const results = useMemo(() => {
    const pages = [
      { label: "Send Money", desc: "Create a secure transfer", href: "/send" },
      { label: "Cards", desc: "Manage virtual cards and limits", href: "/cards" },
      { label: "Receive", desc: "View accounts and deposit details", href: "/receive" },
      { label: "Notifications", desc: "Review live banking alerts", href: "/notifications" },
      { label: "Settings", desc: "Security and profile preferences", href: "/settings" },
    ];
    const transactionResults = transactions.map((item) => ({
      label: item.name,
      desc: `${item.status} / ${item.method}`,
      href: "/notifications",
    }));
    const alertResults = alerts.map((item) => ({
      label: item.title,
      desc: item.desc,
      href: "/notifications",
    }));
    const term = query.toLowerCase();

    return [...pages, ...transactionResults, ...alertResults]
      .filter((item) => `${item.label} ${item.desc}`.toLowerCase().includes(term))
      .slice(0, 7);
  }, [alerts, query, transactions]);

  return (
    <>
      <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <AurexMark
              label="Aurex Bank"
              className="h-9 w-9 rounded-lg"
              imageClassName="p-1.5"
            />
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">
              Banking Systems Online
            </p>
          </div>

          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Welcome back, <span className="text-green-400">{firstName}</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500 sm:text-base">
            {greeting}. Your Aurex Black dashboard is synced and ready.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className="bank-button flex h-12 w-12 items-center justify-center rounded-lg text-zinc-300"
          >
            <AppIcon name="search" className="h-5 w-5" />
          </button>

          <Link
            href="/notifications"
            aria-label="Notifications"
            className="bank-button relative flex h-12 w-12 items-center justify-center rounded-lg text-zinc-300"
          >
            <AppIcon name="bell" className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-400 px-1 text-[10px] font-black text-black">
                {unreadCount}
              </span>
            )}
          </Link>

          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] py-1.5 pl-2 pr-3"
          >
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-md bg-green-400 text-lg font-black text-black">
              {currentProfile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentProfile.avatar_url}
                  alt={`${firstName} profile photo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                firstName.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-black text-white">{firstName}</span>
              {/* tier label removed */}
            </span>
          </Link>
        </div>
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 px-4 py-6 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-[#080a09] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
              <AppIcon name="search" className="h-5 w-5" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search transfers, alerts, cards, settings..."
                className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-zinc-600"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="bank-button rounded-lg px-3 py-2 text-sm font-black"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-3">
              {(query ? results : results.slice(0, 5)).map((item) => (
                <Link
                  key={`${item.label}-${item.desc}`}
                  href={item.href}
                  onClick={() => setSearchOpen(false)}
                  className="block rounded-lg p-4 transition-all hover:bg-white/[0.055]"
                >
                  <p className="font-black">{item.label}</p>
                  <p className="mt-1 text-sm text-zinc-500">{item.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
