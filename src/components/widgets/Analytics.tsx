"use client";

import { useMemo } from "react";

import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";

export default function Analytics() {
  const { expenses, transactions } = useBanking();
  const analytics = useMemo(() => {
    const spending = transactions.filter((item) => item.amount < 0);
    const total = spending.reduce((sum, item) => sum + Math.abs(item.amount), 0) || 1;
    const byCategory = new Map<string, number>();

    spending.forEach((item) => {
      const category = item.type || "Spending";
      byCategory.set(category, (byCategory.get(category) ?? 0) + Math.abs(item.amount));
    });

    return [...byCategory.entries()]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 3)
      .map(([category, value], index) => {
        const percent = Math.round((value / total) * 100);
        const colors = ["bg-green-400", "bg-emerald-300", "bg-zinc-300"];

        return {
          category,
          percent: `${percent}%`,
          value,
          width: `${Math.max(percent, 8)}%`,
          color: colors[index] ?? "bg-green-400",
        };
      });
  }, [transactions]);

  return (
    <section className="bank-surface rounded-lg p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-black tracking-tight">Analytics</h2>
        <button className="bank-button rounded-lg px-4 py-2.5 text-sm font-semibold">
          Reports
        </button>
      </div>

      <div className="bank-panel mt-5 rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Monthly Spending</p>
            <h3 className="mt-3 text-4xl font-black tracking-tight">
              <PrivateAmount value={expenses} maximumFractionDigits={0} minimumFractionDigits={0} />
            </h3>
          </div>
          <div className="text-right">
            <div className="rounded-md bg-green-400/10 px-3 py-2 text-sm font-bold text-green-400">
              -18%
            </div>
            <p className="mt-2 text-sm text-zinc-500">vs last month</p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {analytics.map((item) => (
          <div key={item.category} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">{item.category}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  <PrivateAmount value={item.value} maximumFractionDigits={0} minimumFractionDigits={0} />
                </p>
              </div>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-bold">
                {item.percent}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/40">
              <div className={`h-full rounded-full ${item.color}`} style={{ width: item.width }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
