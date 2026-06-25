"use client";

import Link from "next/link";

import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";

export default function Transactions() {
  const { transactions } = useBanking();

  return (
    <section className="bank-surface rounded-lg p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-black tracking-tight">Recent Transactions</h2>
        <div className="flex items-center gap-2">
          <button className="bank-button rounded-lg px-4 py-2 text-sm font-semibold">
            Filters
          </button>
          <Link
            href="/notifications"
            className="rounded-lg bg-green-400 px-4 py-2 text-sm font-black text-black transition-all hover:bg-green-300"
          >
            View All
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {transactions.slice(0, 5).map((tx) => {
          const positive = tx.amount > 0;
          const code = tx.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={tx.id}
              className="grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4 transition-all hover:bg-white/[0.055] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/[0.055] text-xs font-black tracking-wide text-zinc-400">
                  {code || "NV"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-black">{tx.name}</h3>
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                      {tx.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-400">{tx.type}</p>
                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {tx.method} / {tx.time}
                  </p>
                </div>
              </div>
              <h3
                className={`text-left text-xl font-black sm:text-right ${
                  positive ? "text-green-400" : "text-red-400"
                }`}
              >
                <PrivateAmount
                  value={Math.abs(tx.amount)}
                  prefix={positive ? "+$" : "-$"}
                  maximumFractionDigits={0}
                  minimumFractionDigits={0}
                />
              </h3>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <p className="text-xs text-zinc-500">Latest verified banking transactions</p>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-400">Live</p>
      </div>
    </section>
  );
}
