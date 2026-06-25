"use client";

import { useBanking } from "../../context/BankingContext";

export default function Notifications() {
  const { alerts } = useBanking();

  return (
    <div className="bank-surface rounded-lg p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-zinc-400">
            Notifications
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Live Alerts
          </h2>
        </div>

        <div className="rounded-lg bg-green-500/10 px-4 py-2 text-sm font-bold text-green-400">
          Live
        </div>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5 text-center text-zinc-400">
            No notifications yet
          </div>
        )}

        {alerts.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-white/10 bg-white/[0.035] p-5 transition-all hover:bg-white/[0.06]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-green-500/10 text-xs font-black text-green-400">
                  {item.type.slice(0, 2).toUpperCase()}
                </div>

                <div>
                  <h3 className="text-lg font-black">{item.title}</h3>

                  <p className="mt-1 text-sm text-zinc-400">{item.desc}</p>
                </div>
              </div>

              {item.unread && <div className="mt-2 h-2.5 w-2.5 rounded-full bg-green-400" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
