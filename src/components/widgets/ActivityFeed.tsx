"use client";

import Link from "next/link";

import AppIcon from "../ui/AppIcon";
import { useBanking, type BankAlert } from "../../context/BankingContext";
import { PrivateMoneyText } from "../ui/PrivateAmount";

function iconForAlert(type: BankAlert["type"]) {
  if (type === "Payment" || type === "Savings") return "receive" as const;
  if (type === "Crypto") return "crypto" as const;
  if (type === "Transfer") return "transfer" as const;
  return "shield" as const;
}

export default function ActivityFeed() {
  const { alerts, transactions, unreadCount } = useBanking();
  const activities = alerts.slice(0, 5).map((alert) => ({
    id: alert.id,
    title: alert.title,
    desc: alert.desc,
    time: alert.time,
    icon: iconForAlert(alert.type),
    status: alert.status,
  }));
  const liveSignals = [
    {
      label: "Unread",
      value: String(unreadCount),
      status: "Alert queue",
      icon: "bell" as const,
    },
    {
      label: "Tracked",
      value: String(alerts.length),
      status: "Signals online",
      icon: "activity" as const,
    },
    {
      label: "Ledger",
      value: String(transactions.length),
      status: "Entries synced",
      icon: "check" as const,
    },
  ];
  const monitoringLevels = [34, 52, 43, 68, 57, 82, 66, 91, 73, 88, 78, 96];

  return (
    <section className="bank-surface flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-lg p-5">
      <div className="mb-4 flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-400">
            Live Banking Activity
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Activity Feed</h2>
        </div>
        <Link
          href="/notifications"
          className="bank-button shrink-0 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          View All
        </Link>
      </div>

      <div className="space-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="grid min-w-0 gap-3 rounded-lg px-3 py-3 transition-all hover:bg-white/[0.045] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.055] text-zinc-500">
                <AppIcon name={activity.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black">{activity.title}</h3>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  <PrivateMoneyText text={activity.desc} />
                </p>
              </div>
            </div>
            <div className="min-w-0 text-left sm:text-right">
              <span className="inline-flex max-w-full rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                {activity.status}
              </span>
              <p className="mt-1.5 text-[11px] text-zinc-600">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {liveSignals.map((signal) => (
          <div
            key={signal.label}
            className="flex flex-col rounded-lg border border-white/10 bg-black/20 p-3"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">
                {signal.label}
              </p>
              <h3 className="mt-2 text-xl font-black text-white">{signal.value}</h3>
            </div>
            <div className="mt-auto flex items-center gap-2 pt-4 text-green-400">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-400/10">
                <AppIcon name={signal.icon} className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold leading-tight">
                {signal.status}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex min-h-44 flex-1 flex-col rounded-lg border border-green-300/15 bg-green-400/[0.045] p-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-green-400">
              Network Activity
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Security, card, and transfer signals
            </p>
          </div>
          <span className="rounded-md border border-green-300/15 bg-green-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-green-300">
            Stable
          </span>
        </div>

        <div className="relative mt-4 flex h-28 shrink-0 items-end gap-1.5 overflow-hidden rounded-md border border-white/[0.07] bg-black/25 px-3 py-3 sm:h-auto sm:min-h-24 sm:flex-1">
          <span className="absolute inset-x-3 top-1/4 border-t border-white/[0.05]" />
          <span className="absolute inset-x-3 top-1/2 border-t border-white/[0.05]" />
          <span className="absolute inset-x-3 top-3/4 border-t border-white/[0.05]" />
          {monitoringLevels.map((level, index) => (
            <span
              key={`${level}-${index}`}
              className="relative z-10 min-h-2 flex-1 rounded-sm bg-green-400/75"
              style={{ height: `${level}%` }}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-600">
          <span>12 hours ago</span>
          <span>Live now</span>
        </div>
      </div>

      <div className="mt-4 flex min-w-0 flex-col items-start gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-400">
          Live Monitoring
        </p>
        <p className="max-w-full text-[11px] text-zinc-600">Synced with banking systems</p>
      </div>
    </section>
  );
}
