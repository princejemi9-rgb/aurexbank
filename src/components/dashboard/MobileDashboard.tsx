"use client";

import { memo, useMemo } from "react";
import Link from "next/link";

import AppIcon from "../ui/AppIcon";
import { BalancePrivacyToggle, PrivateAmount } from "../ui/PrivateAmount";
import { useBanking } from "../../context/BankingContext";

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
        {title}
      </p>
      {href && (
        <Link href={href} className="text-[11px] font-black text-green-400">
          View all
        </Link>
      )}
    </div>
  );
}

function TrendLine() {
  return (
    <svg
      aria-hidden="true"
      className="h-20 w-full text-green-400"
      viewBox="0 0 180 90"
      fill="none"
    >
      <path
        d="M8 72C23 60 31 58 43 58C58 58 61 42 75 42C91 42 95 22 110 22C123 22 126 34 139 31C154 28 159 15 172 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M8 72C23 60 31 58 43 58C58 58 61 42 75 42C91 42 95 22 110 22C123 22 126 34 139 31C154 28 159 15 172 12V90H8V72Z"
        fill="url(#mobileBalanceGradient)"
      />
      {[43, 75, 110, 139, 172].map((x) => (
        <path
          key={x}
          d={`M${x} 88V18`}
          stroke="currentColor"
          strokeDasharray="2 4"
          strokeOpacity="0.18"
        />
      ))}
      <circle cx="172" cy="12" r="4" fill="currentColor" />
      <defs>
        <linearGradient id="mobileBalanceGradient" x1="90" x2="90" y1="12" y2="90">
          <stop stopColor="currentColor" stopOpacity="0.24" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MobilePulseSummary({
  netFlow,
  settled,
  status,
  unreadCount,
}: {
  netFlow: number;
  settled: number;
  status: string;
  unreadCount: number;
}) {
  return (
    <section className="mobile-dashboard-pulse rounded-lg border border-green-300/15 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-300 shadow-[0_0_14px_rgba(134,239,172,0.45)]" />
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-green-300">
              Live Banking Pulse
            </p>
          </div>
          <h2 className="mt-2 text-lg font-black tracking-tight">
            Network synced
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Cards, transfers, and security checks are moving in real time.
          </p>
        </div>

        <div className="shrink-0 rounded-lg border border-green-300/20 bg-green-400/[0.08] px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
            Status
          </p>
          <p className="mt-1 text-sm font-black text-green-300">{status}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Net Flow", value: <PrivateAmount value={netFlow} /> },
          { label: "Settled", value: `${settled} items` },
          { label: "Alerts", value: unreadCount ? `${unreadCount} open` : "Clear" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
              {item.label}
            </p>
            <p className="mt-2 truncate text-sm font-black text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const MobileDashboard = memo(function MobileDashboard() {
  const {
    alerts,
    balance,
    currentProfile,
    income,
    reserve,
    transactions,
    unreadCount,
  } = useBanking();
  const firstName = currentProfile.firstName;
  const primaryTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);
  const latestAlert = alerts[0];

  const quickActions = useMemo(
    () => [
      { label: "Transfer", icon: "send" as const, href: "/send" },
      { label: "Pay", icon: "pay" as const, href: "/payments" },
      { label: "Deposit", icon: "receive" as const, href: "/receive" },
      { label: "Cards", icon: "card" as const, href: "/cards" },
    ],
    []
  );

  const accounts = useMemo(
    () => [
      {
        name: "Primary Checking",
        meta: `**** ${currentProfile.customerId.slice(-4) || "4582"}`,
        amount: balance,
        icon: "wallet" as const,
      },
      {
        name: "Reserve Savings",
        meta: "Goal account",
        amount: reserve,
        icon: "spark" as const,
      },
    ],
    [balance, currentProfile.customerId, reserve]
  );

  const pulse = useMemo(() => {
    const settled = transactions.filter((item) => item.status === "Completed").length;
    const inbound = transactions
      .filter((item) => item.amount > 0)
      .reduce((sum, item) => sum + item.amount, 0);
    const outbound = transactions
      .filter((item) => item.amount < 0)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);

    return {
      netFlow: inbound - outbound,
      settled,
      status: alerts.some((item) => item.type === "Security" && item.unread)
        ? "Reviewing"
        : "Secure",
    };
  }, [alerts, transactions]);

  const snapshotMetrics = useMemo(
    () => [
      {
        label: "Income",
        value: (
          <PrivateAmount
            value={income}
            maximumFractionDigits={0}
            minimumFractionDigits={0}
          />
        ),
      },
      {
        label: "Reserve",
        value: (
          <PrivateAmount
            value={reserve}
            maximumFractionDigits={0}
            minimumFractionDigits={0}
          />
        ),
      },
      { label: "Activity", value: `${transactions.length} items` },
      { label: "Alerts", value: unreadCount ? `${unreadCount} unread` : "Clear" },
    ],
    [income, reserve, transactions.length, unreadCount]
  );

  return (
    <div className="lg:hidden">
      <div className="mobile-dashboard-root mx-auto min-h-screen w-full max-w-[430px] min-w-0 bg-[#020403] px-4 pb-24 pt-5 text-white">
        <header className="flex items-center justify-between gap-4">
          <Link href="/profile" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-green-400 text-base font-black text-black">
              {currentProfile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentProfile.avatar_url}
                  alt={`${firstName} profile photo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                currentProfile.initials.slice(0, 2)
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">
                Welcome back, <span className="text-green-400">{firstName}</span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-zinc-500">
                Aurex Black dashboard
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300"
            >
              <AppIcon name="bell" className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-400 px-1 text-[10px] font-black text-black">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        <section className="mobile-dashboard-balance mt-5 rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(21,45,33,0.92),rgba(6,10,8,0.96))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  Available Balance
                </p>
                <BalancePrivacyToggle
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300"
                  iconClassName="h-4 w-4"
                />
              </div>
              <h1 className="mt-2 text-[2rem] font-black leading-none tracking-tight">
                <PrivateAmount value={balance} />
              </h1>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-md bg-green-400/20 px-2.5 py-1 text-xs font-black text-green-300">
                  +2.4%
                </span>
                <span className="text-xs text-zinc-500">this month</span>
              </div>
            </div>

            <div className="min-w-[132px] flex-1">
              <TrendLine />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-green-300/15 bg-green-400/[0.07] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-zinc-400">Account status</span>
              <span className="text-xs font-black text-green-300">Active</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2.5">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-3 text-center text-zinc-200"
              >
                <AppIcon name={action.icon} className="h-5 w-5 text-green-400" />
                <span className="mt-2 truncate text-[11px] font-semibold">{action.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <MobilePulseSummary
            netFlow={pulse.netFlow}
            settled={pulse.settled}
            status={pulse.status}
            unreadCount={unreadCount}
          />
        </section>

        <section className="mt-5">
          <SectionHeader title="Accounts" href="/profile" />
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
            {accounts.map((account, index) => (
              <Link
                key={account.name}
                href="/profile"
                className={`flex items-center justify-between gap-3 p-3 ${
                  index ? "border-t border-white/10" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-400/15 text-green-300">
                    <AppIcon name={account.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{account.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {account.meta}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs font-black">
                  <PrivateAmount value={account.amount} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <SectionHeader title="Recent Activity" href="/notifications" />
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
            {primaryTransactions.map((tx, index) => {
              const positive = tx.amount > 0;
              const code = tx.name.slice(0, 1).toUpperCase();

              return (
                <Link
                  key={tx.id}
                  href="/notifications"
                  className={`flex items-center justify-between gap-3 p-3 ${
                    index ? "border-t border-white/10" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-black/40 text-sm font-black text-green-300">
                      {code}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black">{tx.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {tx.time}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-right text-xs font-black ${
                      positive ? "text-green-400" : "text-zinc-200"
                    }`}
                  >
                    <PrivateAmount
                      value={Math.abs(tx.amount)}
                      prefix={positive ? "+$" : "-$"}
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <SectionHeader title="Your Cards" href="/cards" />
          <Link
            href="/cards"
            className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3"
          >
            <span className="flex h-12 w-20 shrink-0 items-end justify-end rounded-md bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_30%),linear-gradient(135deg,#171717,#020202)] px-2 py-2 text-sm font-black italic text-white">
              VISA
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black">Debit Card</span>
              <span className="mt-0.5 block truncate text-xs text-zinc-500">**** 4582</span>
            </span>
            <span className="text-xs font-semibold text-green-400">
              <PrivateAmount value={balance} />
            </span>
          </Link>
        </section>

        {latestAlert && (
          <section className="mt-5 rounded-lg border border-green-300/15 bg-green-400/[0.07] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-green-300">
              Security status
            </p>
            <h2 className="mt-2 text-base font-black">{latestAlert.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{latestAlert.desc}</p>
          </section>
        )}

        <section className="mt-5">
          <SectionHeader title="Snapshot" />
          <div className="grid grid-cols-2 gap-3">
            {snapshotMetrics.map((item) => (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                  {item.label}
                </p>
                <p className="mt-2 truncate text-lg font-black">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
});

export default MobileDashboard;
