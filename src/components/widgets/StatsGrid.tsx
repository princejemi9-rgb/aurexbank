"use client";

import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";

export default function StatsGrid() {
  const { balance, expenses, income, reserve } = useBanking();
  const stats = [
    {
      title: "Income",
      value: <PrivateAmount value={income} maximumFractionDigits={0} minimumFractionDigits={0} />,
      growth: "+12.5%",
      desc: "Monthly deposits",
      tone: "text-green-400",
    },
    {
      title: "Expenses",
      value: <PrivateAmount value={expenses} maximumFractionDigits={0} minimumFractionDigits={0} />,
      growth: "-4.3%",
      desc: "Monthly spending",
      tone: "text-red-400",
    },
    {
      title: "Reserve",
      value: <PrivateAmount value={reserve} maximumFractionDigits={0} minimumFractionDigits={0} />,
      growth: "+8.2%",
      desc: "Savings buffer",
      tone: "text-green-300",
    },
    {
      title: "Available",
      value: <PrivateAmount value={balance} maximumFractionDigits={0} minimumFractionDigits={0} />,
      growth: "Live",
      desc: "Supabase balance",
      tone: "text-green-400",
    },
  ];

  return (
    <section>
      <div className="mb-4">
        <p className="text-sm text-zinc-500">Financial Overview</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Live Metrics</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.title} className="bank-surface rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-500">{stat.title}</p>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                {stat.growth}
              </span>
            </div>
            <h3 className="mt-4 text-3xl font-black tracking-tight">{stat.value}</h3>
            <p className={`mt-3 text-sm font-bold ${stat.tone}`}>{stat.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
