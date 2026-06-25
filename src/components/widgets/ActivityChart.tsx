"use client";

import { useMemo } from "react";

import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";

export default function ActivityChart() {
  const { expenses, transactions } = useBanking();
  const bars = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = days.map(() => 0);

    transactions
      .filter((item) => item.amount < 0)
      .forEach((item, index) => {
        totals[index % days.length] += Math.abs(item.amount);
      });

    const highest = Math.max(...totals, 1);

    return days.map((day, index) => ({
      day,
      amount: totals[index],
      height: `${Math.max((totals[index] / highest) * 100, 8)}%`,
    }));
  }, [transactions]);

  return (
    <section className="bank-surface rounded-lg p-5 lg:p-6">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-green-400">Financial Analytics</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Weekly Spending</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Spending activity across your primary checking account
          </p>
        </div>
        <div className="bank-panel rounded-lg px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
            This Week
          </p>
          <h3 className="mt-1 text-xl font-black text-green-400">+12%</h3>
        </div>
      </div>

      <div className="flex h-48 items-end justify-between gap-2 sm:h-56 sm:gap-3">
        {bars.map((bar) => (
          <div key={bar.day} className="flex h-full flex-1 flex-col items-center">
            <p className="mb-3 text-xs font-semibold text-zinc-500">
              <PrivateAmount
                value={bar.amount}
                maximumFractionDigits={0}
                minimumFractionDigits={0}
              />
            </p>
            <div className="relative flex w-full flex-1 items-end rounded-lg bg-black/25">
              <div
                className="w-full rounded-lg bg-gradient-to-t from-green-500 to-green-300 transition-all duration-300 hover:brightness-110"
                style={{ height: bar.height }}
              />
            </div>
            <p className="mt-3 text-xs font-bold text-zinc-400 sm:text-sm">{bar.day}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          {
            label: "Highest Day",
            value: bars.reduce((best, bar) => (bar.amount > best.amount ? bar : best), bars[0])
              .day,
          },
          { label: "Average", value: <PrivateAmount value={expenses / 7} maximumFractionDigits={0} minimumFractionDigits={0} /> },
          { label: "Trend", value: "Stable" },
        ].map((item) => (
          <div key={item.label} className="bank-panel rounded-lg p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              {item.label}
            </p>
            <h3 className="mt-2 truncate text-base font-black sm:text-lg">{item.value}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
