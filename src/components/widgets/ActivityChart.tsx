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
    <section className="bank-surface min-w-0 overflow-hidden rounded-lg p-4 sm:p-5 lg:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-400">Financial Analytics</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Weekly Spending</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Spending activity across your primary checking account
          </p>
        </div>
        <div className="bank-panel w-full rounded-lg px-3 py-2.5 sm:w-auto sm:px-4 sm:py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 sm:text-xs">
            This Week
          </p>
          <h3 className="mt-1 text-lg font-black text-green-400 sm:text-xl">+12%</h3>
        </div>
      </div>

      <div className="flex h-40 items-end justify-between gap-1 overflow-hidden sm:h-56 sm:gap-2.5">
        {bars.map((bar) => (
          <div key={bar.day} className="flex h-full min-w-0 flex-1 flex-col items-center overflow-hidden">
            <p className="mb-2 max-w-full truncate text-[10px] font-semibold text-zinc-500 sm:text-xs">
              <PrivateAmount
                value={bar.amount}
                maximumFractionDigits={0}
                minimumFractionDigits={0}
              />
            </p>
            <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-lg bg-black/25">
              <div
                className="w-full rounded-lg bg-gradient-to-t from-green-500 to-green-300 transition-all duration-300 hover:brightness-110"
                style={{ height: bar.height }}
              />
            </div>
            <p className="mt-2 text-[10px] font-bold text-zinc-400 sm:mt-3 sm:text-sm">{bar.day}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3">
        {[
          {
            label: "Highest Day",
            value: bars.reduce((best, bar) => (bar.amount > best.amount ? bar : best), bars[0])
              .day,
          },
          { label: "Average", value: <PrivateAmount value={expenses / 7} maximumFractionDigits={0} minimumFractionDigits={0} /> },
          { label: "Trend", value: "Stable" },
        ].map((item) => (
          <div key={item.label} className="bank-panel min-w-0 rounded-lg p-3 sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 sm:text-xs">
              {item.label}
            </p>
            <h3 className="mt-2 truncate text-sm font-black sm:text-base lg:text-lg">{item.value}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
