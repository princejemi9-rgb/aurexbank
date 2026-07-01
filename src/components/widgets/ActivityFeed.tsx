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
    { label: "Unread", value: String(unreadCount) },
    { label: "Tracked", value: String(alerts.length) },
    { label: "Ledger", value: String(transactions.length) },
  ];

  return (
    <section className="bank-surface flex min-w-0 flex-col rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-400">
            Live Banking Activity
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Activity Feed</h2>
        </div>
        <Link href="/notifications" className="bank-button rounded-lg px-4 py-2 text-sm font-semibold">
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
          <div key={signal.label} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">
              {signal.label}
            </p>
            <h3 className="mt-2 text-xl font-black text-white">{signal.value}</h3>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-400">
          Live Monitoring
        </p>
        <p className="text-[11px] text-zinc-600">Synced with banking systems</p>
      </div>
    </section>
  );
}
