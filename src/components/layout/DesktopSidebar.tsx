"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AurexBrand from "../brand/AurexBrand";
import AppIcon from "../ui/AppIcon";
import { useAdminStatus } from "../../context/AdminStatusContext";

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { isAdmin, loading: adminStatusLoading } = useAdminStatus();
  const canShowAdmin = isAdmin && !adminStatusLoading;

  const navItems = [
    { name: "Dashboard", icon: "dashboard" as const, href: "/dashboard", section: "primary" as const },
    { name: "Send", icon: "transfer" as const, href: "/send", section: "primary" as const },
    { name: "Bill Pay", icon: "pay" as const, href: "/payments", section: "primary" as const },
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
        return canShowAdmin;
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
            className={`desktop-sidebar-nav-item group relative flex items-center gap-3 overflow-hidden rounded-lg border shadow-[0_10px_26px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] ${
              active
                ? "border-green-300/35 bg-green-400/[0.11] text-white"
                : "border-white/[0.06] bg-white/[0.035] text-zinc-400 hover:border-green-300/20 hover:bg-white/[0.07] hover:text-zinc-100"
            }`}
          >
            {active && (
              <span className="brand-glow-md absolute left-0 top-0 h-full w-1 rounded-r-full bg-green-300" />
            )}

            <span
              className={`desktop-sidebar-nav-icon flex shrink-0 items-center justify-center rounded-md transition-colors ${
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
      className="desktop-sidebar hidden h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[var(--brand-background)] shadow-[22px_0_70px_rgba(0,0,0,0.28)] lg:fixed lg:left-0 lg:top-0 lg:z-50 lg:flex"
    >
      <div className="desktop-sidebar-header shrink-0">
        <div className="desktop-sidebar-brand-card rounded-lg border border-white/[0.07] bg-white/[0.035] shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <AurexBrand
            className="gap-3"
            markClassName="desktop-sidebar-brand-mark rounded-lg"
            titleClassName="desktop-sidebar-brand-title"
            taglineClassName="text-[11px]"
          />
        </div>
      </div>

      <nav className="desktop-sidebar-nav scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <div>
          <p className="desktop-sidebar-section-label px-2 font-bold uppercase tracking-[0.18em] text-zinc-600">
            Banking
          </p>
          <div className="desktop-sidebar-nav-items">{renderNavItems("primary")}</div>
        </div>

        <div className="desktop-sidebar-account">
          <p className="desktop-sidebar-section-label px-2 font-bold uppercase tracking-[0.18em] text-zinc-600">
            Account
          </p>
          <div className="desktop-sidebar-nav-items">{renderNavItems("account")}</div>
        </div>
      </nav>

      <div className="desktop-sidebar-tier-wrap shrink-0">
        <div className="desktop-sidebar-tier-card rounded-lg border border-green-300/20 bg-green-400/[0.075] shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="desktop-sidebar-tier-title truncate font-black text-white">Aurex Black</p>
              <p className="desktop-sidebar-tier-copy mt-0.5 truncate text-green-200/70">Premium banking tier</p>
            </div>
            <span className="desktop-sidebar-tier-icon flex shrink-0 items-center justify-center rounded-md bg-green-400/15 text-green-300">
              <AppIcon name="spark" className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="desktop-sidebar-tier-details space-y-0.5 border-t border-white/[0.08]">
            <div className="desktop-sidebar-tier-copy flex items-center justify-between gap-3">
              <span className="text-zinc-500">Transfer Limit</span>
              <span className="font-bold text-zinc-100">$25K daily</span>
            </div>
            <div className="desktop-sidebar-tier-copy flex items-center justify-between gap-3">
              <span className="text-zinc-500">Priority Support</span>
              <span className="font-bold text-green-300">Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
