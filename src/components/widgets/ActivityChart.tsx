"use client";

import { useMemo } from "react";

import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";

export default function ActivityChart() {
  const { transactions } = useBanking();
  const bars = useMemo(() => {
    const spending = transactions.filter(item => item.amount < 0).slice(0, 7).reverse();
    const highest = Math.max(...spending.map(item => Math.abs(item.amount)), 1);
    return spending.map((item, index) => ({
      day: `#${index + 1}`,
      name: item.name,
      amount: Math.abs(item.amount),
      height: `${(Math.abs(item.amount) / highest) * 100}%`,
    }));
  }, [transactions]);
  const total = bars.reduce((sum, bar) => sum + bar.amount, 0);

  return (
    <section className="bank-surface min-w-0 overflow-hidden rounded-lg p-4 sm:p-5 lg:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-400">Financial Analytics</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Recent outgoing payments</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Your last seven outgoing transactions, from oldest to newest
          </p>
        </div>
        {bars.length > 0 && <div className="bank-panel w-full rounded-lg px-3 py-2.5 sm:w-auto sm:px-4 sm:py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 sm:text-xs">
            Shown total
          </p>
          <h3 className="mt-1 text-lg font-black text-green-400 sm:text-xl"><PrivateAmount value={total} /></h3>
        </div>}
      </div>

      {bars.length === 0 && <p className="mb-4 rounded-lg border border-dashed border-white/15 p-5 text-sm text-zinc-400">No outgoing payments yet. Your spending chart will grow with your activity.</p>}
      {bars.length > 0 && <div className="flex h-40 items-end justify-between gap-1 overflow-hidden sm:h-56 sm:gap-2.5">
        {bars.map((bar) => (
          <div title={bar.name} key={bar.day} className="flex h-full min-w-0 flex-1 flex-col items-center overflow-hidden">
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
      </div>}

      {bars.length > 0 && <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3">
        {[
          {
            label: "Largest payment",
            value: <PrivateAmount value={Math.max(...bars.map(bar => bar.amount), 0)} />,
          },
          { label: "Average", value: <PrivateAmount value={bars.length ? total / bars.length : 0} maximumFractionDigits={0} minimumFractionDigits={0} /> },
          { label: "Payments shown", value: String(bars.length) },
        ].map((item) => (
          <div key={item.label} className="bank-panel min-w-0 rounded-lg p-3 sm:p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 sm:text-xs">
              {item.label}
            </p>
            <h3 className="mt-2 truncate text-sm font-black sm:text-base lg:text-lg">{item.value}</h3>
          </div>
        ))}
      </div>}
    </section>
  );
}
