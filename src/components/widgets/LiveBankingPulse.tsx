"use client";

import { useEffect, useMemo, useState } from "react";

import { useBanking } from "../../context/BankingContext";
import AppIcon from "../ui/AppIcon";
import { PrivateAmount } from "../ui/PrivateAmount";

type LiveBankingPulseProps = {
  compact?: boolean;
};

function getClockLabel(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LiveBankingPulse({ compact = false }: LiveBankingPulseProps) {
  const { alerts, balance, transactions } = useBanking();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activity = useMemo(() => {
    const settled = transactions.filter((item) => item.status === "Completed").length;
    const inbound = transactions
      .filter((item) => item.amount > 0)
      .reduce((sum, item) => sum + item.amount, 0);
    const outbound = transactions
      .filter((item) => item.amount < 0)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);

    return {
      inbound,
      outbound,
      settled,
      status: alerts.some((item) => item.type === "Security" && item.unread)
        ? "Reviewing"
        : "Secure",
    };
  }, [alerts, transactions]);

  const metrics = [
    {
      label: "Ledger Volume",
      value: <PrivateAmount value={activity.inbound + activity.outbound} />,
      icon: "activity" as const,
    },
    {
      label: "Settled",
      value: `${activity.settled} items`,
      icon: "check" as const,
    },
    {
      label: "Client Since",
      value: "2018",
      icon: "shield" as const,
    },
  ];

  return (
    <section className="bank-surface overflow-hidden rounded-lg p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-300 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-300" />
            </span>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-green-300">
              Live Banking Pulse
            </p>
          </div>
          <h2 className="mt-2 text-xl font-black tracking-tight lg:text-2xl">
            Network synced at {getClockLabel(now)}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Cards, transfers, and security checks are moving in real time.
          </p>
        </div>

        <div className="shrink-0 rounded-lg border border-green-300/20 bg-green-400/[0.08] px-3 py-2 text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
            Status
          </p>
          <p className="mt-1 text-sm font-black text-green-300">{activity.status}</p>
        </div>
      </div>

      <div className="mt-4 h-24 rounded-lg border border-white/[0.08] bg-black/25 p-3">
        <svg aria-hidden="true" className="h-full w-full text-green-300" viewBox="0 0 260 92" fill="none">
          <path
            d="M4 70C22 62 30 48 48 51C66 54 69 28 89 30C110 32 112 60 133 55C154 50 156 22 179 19C203 16 205 39 224 34C239 30 247 20 256 16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            d="M4 70C22 62 30 48 48 51C66 54 69 28 89 30C110 32 112 60 133 55C154 50 156 22 179 19C203 16 205 39 224 34C239 30 247 20 256 16V92H4V70Z"
            fill="url(#livePulseFill)"
          />
          {[48, 89, 133, 179, 224].map((x) => (
            <path key={x} d={`M${x} 86V10`} stroke="currentColor" strokeDasharray="2 6" strokeOpacity="0.16" />
          ))}
          <circle cx="256" cy="16" r="4.5" fill="currentColor" />
          <defs>
            <linearGradient id="livePulseFill" x1="130" x2="130" y1="16" y2="92">
              <stop stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-3"}`}>
        {metrics.map((item) => (
          <div key={item.label} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-400/10 text-green-300">
              <AppIcon name={item.icon} className="h-4 w-4" />
            </span>
            <p className="mt-3 truncate text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
              {item.label}
            </p>
            <p className="mt-1 truncate text-sm font-black text-white">{item.value}</p>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="mt-4 rounded-lg border border-green-300/15 bg-green-400/[0.06] px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-zinc-400">Available liquidity</span>
            <span className="font-black text-green-300">
              <PrivateAmount value={balance} />
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
