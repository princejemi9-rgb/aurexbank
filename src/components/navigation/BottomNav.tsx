"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import AppIcon from "../ui/AppIcon";
import { useAdminStatus } from "../../context/AdminStatusContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useAdminStatus();
  const [moreOpen, setMoreOpen] = useState(false);

  const navItems = [
    { name: "Home", icon: "dashboard" as const, href: "/dashboard" },
    { name: "Send", icon: "send" as const, href: "/send" },
    { name: "Receive", icon: "receive" as const, href: "/receive" },
    { name: "Pay", icon: "pay" as const, href: "/payments" },
  ];

  const moreItems = [
    { name: "Cards", icon: "card" as const, href: "/cards" },
    { name: "Notifications", icon: "bell" as const, href: "/notifications" },
    { name: "Settings", icon: "settings" as const, href: "/settings" },
    { name: "Profile", icon: "profile" as const, href: "/profile" },
    { name: "Security", icon: "shield" as const, href: "/security/activity" },
    { name: "Support", icon: "help" as const, href: "/support" },
    ...(isAdmin
      ? [{ name: "Admin", icon: "admin" as const, href: "/admin" }]
      : []),
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = moreItems.some((item) => isActive(item.href));

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 overflow-hidden rounded-lg border border-white/[0.1] bg-[var(--brand-background)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-green-300">
                  More
                </p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300"
              >
                <AppIcon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3">
              {moreItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-16 items-center gap-3 rounded-lg border px-3 py-3 transition-colors ${
                      active
                        ? "border-green-300/30 bg-green-400/[0.1] text-white"
                        : "border-white/[0.08] bg-white/[0.035] text-zinc-300"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        active ? "bg-green-400/20 text-green-300" : "bg-black/30 text-zinc-500"
                      }`}
                    >
                      <AppIcon name={item.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 truncate text-sm font-black">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="mobile-bottom-navigation fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="border-t border-white/[0.08] bg-[var(--brand-background)] px-2 pb-[env(safe-area-inset-bottom)] pt-2">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${navItems.length + 1}, minmax(0, 1fr))` }}
          >
            {navItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.name}
                  className={`flex h-14 min-w-0 flex-col items-center justify-center rounded-lg border px-2 transition-colors ${
                    active
                      ? "border-green-300/25 bg-green-400/[0.08] text-green-200"
                      : "border-transparent text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
                  }`}
                >
                  <AppIcon name={item.icon} className="h-5 w-5" />
                  <span className="mt-1 truncate text-[11px] font-semibold">
                    {item.name}
                  </span>
                </Link>
              );
            })}

            <button
              type="button"
              aria-expanded={moreOpen}
              aria-label="Open more navigation"
              onClick={() => setMoreOpen((open) => !open)}
              className={`flex h-14 min-w-0 flex-col items-center justify-center rounded-lg border px-2 transition-colors ${
                moreOpen || moreActive
                  ? "border-green-300/25 bg-green-400/[0.08] text-green-200"
                  : "border-transparent text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              <AppIcon name="more" className="h-5 w-5" />
              <span className="mt-1 truncate text-[11px] font-semibold">More</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
