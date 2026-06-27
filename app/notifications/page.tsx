"use client";

import { useState } from "react";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import { PrivateMoneyText } from "../../src/components/ui/PrivateAmount";
import { useBanking } from "../../src/context/BankingContext";

const tabs = ["All", "Payment", "Security", "Crypto", "Transfer", "Savings"];

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("All");
  const { alerts, markAlertsRead, unreadCount } = useBanking();

  const filteredNotifications =
    activeTab === "All"
      ? alerts
      : alerts.filter((item) => item.type === activeTab);

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content desktop-page-content">
        <div className="app-inner">
          <section className="bank-surface rounded-lg p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                    Real-Time Banking Intelligence
                  </p>
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
                  Notifications
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
                  Monitor transfers, security events, card activity, savings milestones,
                  and market movement from one live alert center.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:w-[320px]">
                <div className="rounded-lg border border-green-300/15 bg-green-400/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-green-300/70">
                    Unread
                  </p>
                  <h2 className="mt-3 text-4xl font-black text-green-300">
                    {unreadCount}
                  </h2>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                    Total
                  </p>
                  <h2 className="mt-3 text-4xl font-black">{alerts.length}</h2>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-lg px-5 py-3 text-sm font-black transition-all ${
                  activeTab === tab
                    ? "bg-green-400 text-black"
                    : "bank-button text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-6 grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <section className="bank-surface rounded-lg p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-500">Alert Stream</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    {activeTab} Alerts
                  </h2>
                </div>
                <button
                  onClick={markAlertsRead}
                  className="bank-button rounded-lg px-4 py-2.5 text-sm font-black"
                >
                  Mark Read
                </button>
              </div>

              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="rounded-lg border border-white/10 bg-white/[0.025] p-5 transition-all hover:bg-white/[0.055]"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-5">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-400/10 text-xs font-black text-green-300">
                          {notification.type.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="break-words text-xl font-black">
                              {notification.title}
                            </h3>
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                              {notification.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                            <PrivateMoneyText text={notification.desc} />
                          </p>
                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-600">
                            {notification.time}
                          </p>
                        </div>
                      </div>

                      {notification.unread && (
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-green-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="min-w-0 space-y-5">
              <section className="bank-surface rounded-lg p-5">
                <p className="text-sm font-semibold text-green-400">System Status</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Banking Systems
                </h2>
                <div className="mt-5 space-y-3">
                  {[
                    "Transfers Operational",
                    "Cards Online",
                    "Fraud Monitoring Enabled",
                    "Alerts Streaming",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-4"
                    >
                      <p className="min-w-0 truncate text-sm font-semibold">{item}</p>
                      <span className="shrink-0 text-xs font-black text-green-400">Active</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-5">
                <p className="text-sm font-semibold text-green-400">
                  Aurex AI Monitoring
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Smart Insights
                </h2>
                <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-zinc-300">
                  No suspicious activity detected. Transfer velocity is within your
                  usual pattern and card controls are fully operational.
                </p>
              </section>
            </aside>
          </div>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
