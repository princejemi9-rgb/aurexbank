"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AurexBrand from "../brand/AurexBrand";
import AppIcon from "../ui/AppIcon";
import { useAdminStatus } from "../../context/AdminStatusContext";

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAdminStatus();

  const navItems = [
    { name: "Dashboard", icon: "dashboard" as const, href: "/dashboard", section: "primary" as const },
    { name: "Send", icon: "send" as const, href: "/send", section: "primary" as const },
    { name: "Receive", icon: "receive" as const, href: "/receive", section: "primary" as const },
    { name: "Cards", icon: "card" as const, href: "/cards", section: "primary" as const },
    { name: "Notifications", icon: "bell" as const, href: "/notifications", section: "primary" as const },
    { name: "Admin", icon: "admin" as const, href: "/admin", adminOnly: true, section: "account" as const },
    { name: "Settings", icon: "settings" as const, href: "/settings", section: "account" as const },
    { name: "Profile", icon: "profile" as const, href: "/profile", section: "account" as const },
    { name: "Security", icon: "shield" as const, href: "/security/activity", section: "account" as const },
    { name: "Support", icon: "help" as const, href: "/support", section: "account" as const },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const renderNavItems = (section: "primary" | "account") =>
    navItems
      .filter((item) => item.section === section)
      .filter((item) => {
        if (!item.adminOnly) return true;
        return isAdmin;
      })
      .map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.name}
            href={item.href}
            target={item.adminOnly ? "_blank" : undefined}
            rel={item.adminOnly ? "noreferrer" : undefined}
            title={item.adminOnly ? "Admin opens in a new tab" : item.name}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-9 items-center gap-3 overflow-hidden rounded-lg border px-3 text-[13px] shadow-[0_10px_26px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] ${
              active
                ? "border-green-300/35 bg-green-400/[0.11] text-white"
                : "border-white/[0.06] bg-white/[0.035] text-zinc-400 hover:border-green-300/20 hover:bg-white/[0.07] hover:text-zinc-100"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-green-300 shadow-[0_0_18px_rgba(74,222,128,0.5)]" />
            )}

            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                active
                  ? "bg-green-400/20 text-green-300"
                  : "bg-black/25 text-zinc-500 group-hover:bg-green-400/10 group-hover:text-green-300"
              }`}
            >
              <AppIcon name={item.icon} className="h-4 w-4" />
            </span>

            <span className="min-w-0 truncate font-semibold leading-none">
              {item.name}
            </span>
          </Link>
        );
      });

  return (
    <aside
      className="hidden h-screen w-[16.25rem] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#050606] shadow-[22px_0_70px_rgba(0,0,0,0.28)] lg:fixed lg:left-0 lg:top-0 lg:z-50 lg:flex"
      style={{ width: "16.25rem", minWidth: "16.25rem", maxWidth: "16.25rem" }}
    >
      <div className="shrink-0 px-4 pb-1.5 pt-3.5">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <AurexBrand
            className="gap-3"
            markClassName="h-12 w-12 rounded-lg"
            titleClassName="text-[1.15rem]"
            taglineClassName="text-[11px]"
          />
        </div>
      </div>

      <nav className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 pb-5 pr-4">
        <div>
          <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
            Banking
          </p>
          <div className="mt-1.5 space-y-1">{renderNavItems("primary")}</div>
        </div>

        <div className="mt-2.5">
          <p className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
            Account
          </p>
          <div className="mt-1.5 space-y-1">{renderNavItems("account")}</div>
        </div>
      </nav>

      <div className="shrink-0 px-4 pb-2.5 pt-1">
        <div className="rounded-lg border border-green-300/20 bg-green-400/[0.075] p-2 shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-black text-white">Aurex Black</p>
              <p className="mt-0.5 truncate text-[10px] text-green-200/70">Premium banking tier</p>
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-400/15 text-green-300">
              <AppIcon name="spark" className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="mt-1.5 space-y-0.5 border-t border-white/[0.08] pt-1.5">
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-zinc-500">Transfer Limit</span>
              <span className="font-bold text-zinc-100">$25K daily</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-zinc-500">Priority Support</span>
              <span className="font-bold text-green-300">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
