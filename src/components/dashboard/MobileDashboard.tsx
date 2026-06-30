"use client";

import { memo, useMemo } from "react";
import Link from "next/link";

import AppIcon from "../ui/AppIcon";
import { BalancePrivacyToggle, PrivateAmount } from "../ui/PrivateAmount";
import { useBanking } from "../../context/BankingContext";
import ActivityChart from "../widgets/ActivityChart";
import ActivityFeed from "../widgets/ActivityFeed";
import AIInsights from "../widgets/AIInsights";
import Analytics from "../widgets/Analytics";
import CryptoPortfolio from "../widgets/CryptoPortfolio";
import LiveCard from "../widgets/LiveCard";
import UpcomingPayments from "../widgets/UpcomingPayments";

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
  const trendPath =
    "M8 72C20 68 27 58 40 59C53 60 58 48 70 46C84 44 87 30 101 29C114 28 121 39 133 35C147 31 153 20 172 13";
  const comparisonPath =
    "M8 77C26 72 35 68 50 66C67 64 77 58 91 56C107 54 120 48 137 45C151 42 161 35 172 31";

  return (
    <div className="relative h-20 w-full">
      <span className="absolute left-0 top-0 z-10 rounded-full bg-green-400/10 px-1.5 py-0.5 text-[7px] font-black tracking-wide text-green-200">
        30D +24.8%
      </span>
      <svg
        role="img"
        aria-label="Thirty-day balance trend, up 24.8 percent"
        className="block h-full w-full"
        viewBox="0 0 180 90"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="mobileTrendStroke" x1="8" x2="172" y1="72" y2="13">
            <stop stopColor="#22c55e" />
            <stop offset="0.55" stopColor="#34d399" />
            <stop offset="1" stopColor="#86efac" />
          </linearGradient>
          <linearGradient id="mobileTrendArea" x1="90" x2="90" y1="12" y2="88">
            <stop stopColor="#22c55e" stopOpacity="0.32" />
            <stop offset="0.65" stopColor="#22c55e" stopOpacity="0.08" />
            <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d="M8 22H172M8 45H172M8 68H172"
          stroke="#ffffff"
          strokeDasharray="1 7"
          strokeLinecap="round"
          strokeOpacity="0.12"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={comparisonPath}
          stroke="#a1a1aa"
          strokeDasharray="3 5"
          strokeOpacity="0.35"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path d={`${trendPath}V88H8Z`} fill="url(#mobileTrendArea)" />
        <path
          d={trendPath}
          stroke="#22c55e"
          strokeOpacity="0.18"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={trendPath}
          stroke="url(#mobileTrendStroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M172 13V83"
          stroke="#86efac"
          strokeDasharray="2 5"
          strokeOpacity="0.28"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="172" cy="13" r="6" fill="#22c55e" fillOpacity="0.16" />
        <circle cx="172" cy="13" r="3" fill="#86efac" />
      </svg>
    </div>
  );
}

function MobilePulseSummary({
  ledgerVolume,
  settled,
  status,
  unreadCount,
}: {
  ledgerVolume: number;
  settled: number;
  status: string;
  unreadCount: number;
}) {
  return (
    <section className="mobile-dashboard-pulse rounded-lg border border-green-300/15 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
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
          { label: "Ledger Volume", value: <PrivateAmount value={ledgerVolume} /> },
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
      ledgerVolume: inbound + outbound,
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
      { label: "Client Since", value: "2018" },
      { label: "Alerts", value: unreadCount ? `${unreadCount} unread` : "Clear" },
    ],
    [income, reserve, unreadCount]
  );

  return (
    <div className="lg:hidden">
      <div className="mobile-dashboard-root mx-auto min-h-screen w-full max-w-[430px] min-w-0 bg-[var(--brand-background)] px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-5 text-white">
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

          <Link
            href="/notifications"
            aria-label={`${unreadCount} unread notifications`}
            className="relative flex h-12 w-11 shrink-0 items-center justify-center text-white transition-colors hover:text-green-300"
          >
            <AppIcon name="bell" className="h-7 w-7" strokeWidth={2.25} />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--brand-background)] bg-green-400 px-1 text-[10px] font-black leading-none text-black">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </header>

        <section className="mobile-dashboard-balance mt-5 rounded-lg border border-white/10 bg-[var(--brand-surface-strong)] p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,38%)] items-start gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="whitespace-nowrap text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500 min-[360px]:text-[10px]">
                  Available Balance
                </p>
                <BalancePrivacyToggle
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300"
                  iconClassName="h-3 w-3"
                />
              </div>
              <h1 className="mt-2 whitespace-nowrap text-[clamp(1.45rem,7.2vw,2rem)] font-black leading-none tracking-tight">
                <PrivateAmount value={balance} />
              </h1>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-md bg-green-400/20 px-2.5 py-1 text-xs font-black text-green-300">
                  +2.4%
                </span>
                <span className="text-xs text-zinc-500">this month</span>
              </div>
            </div>

            <div className="min-w-0">
              <TrendLine />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-green-300/15 bg-green-400/[0.07] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-zinc-400">Account status</span>
              <span className="text-xs font-black text-green-300">Active</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 min-[340px]:grid-cols-4">
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
            ledgerVolume={pulse.ledgerVolume}
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
          <LiveCard />
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

        <section className="mobile-dashboard-details mt-8">
          <div className="mb-4 border-b border-white/10 pb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-green-400">
              Full Dashboard
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Everything in one scroll
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Analytics, insights, assets, payments, and live account activity.
            </p>
          </div>

          <div className="space-y-5">
            <ActivityChart />
            <AIInsights />
            <CryptoPortfolio />
            <Analytics />
            <UpcomingPayments />
            <ActivityFeed />
          </div>
        </section>
      </div>
    </div>
  );
});

export default MobileDashboard;
