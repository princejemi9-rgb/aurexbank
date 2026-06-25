"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AppIcon from "../ui/AppIcon";
import { useAdminStatus } from "../../context/AdminStatusContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { isAdmin } = useAdminStatus();

  const navItems = [
    { name: "Home", icon: "dashboard" as const, href: "/dashboard" },
    { name: "Transfers", icon: "send" as const, href: "/send" },
    { name: "Pay", icon: "pay" as const, href: "/payments" },
    { name: "Cards", icon: "card" as const, href: "/cards" },
    {
      name: "More",
      icon: "more" as const,
      href: isAdmin ? "/admin" : "/settings",
      external: isAdmin,
    },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="mx-3 mb-3 rounded-lg border border-white/[0.08] bg-[#050606]/95 px-2 py-2 shadow-2xl backdrop-blur-2xl">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        >
          {navItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                aria-current={active ? "page" : undefined}
                title={item.external ? "Admin opens in a new tab" : item.name}
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
        </div>
      </div>
    </nav>
  );
}
