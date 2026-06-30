"use client";

import Link from "next/link";

import { useBanking } from "../../context/BankingContext";
import { BalancePrivacyToggle, PrivateAmount } from "../ui/PrivateAmount";

export default function BalanceCard() {
  const { balance, expenses, income, reserve } = useBanking();

  const metrics = [
    { label: "Available", value: <PrivateAmount value={balance} /> },
    { label: "Income", value: <PrivateAmount value={income} prefix="+$" maximumFractionDigits={0} minimumFractionDigits={0} /> },
    { label: "Expenses", value: <PrivateAmount value={expenses} prefix="-$" maximumFractionDigits={0} minimumFractionDigits={0} /> },
    { label: "Reserve", value: <PrivateAmount value={reserve} maximumFractionDigits={0} minimumFractionDigits={0} /> },
  ];

  return (
    <section className="relative overflow-hidden rounded-lg border border-green-300/20 bg-[var(--brand-surface)] p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.38)] lg:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-300/70 to-transparent" />

      <div className="relative z-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-green-300">
                Primary Checking
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <p className="text-sm font-semibold text-zinc-400">
                Total balance
              </p>
              <BalancePrivacyToggle
                className="bank-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300"
                iconClassName="h-4 w-4"
              />
            </div>
            <h2 className="mt-2 break-words text-[clamp(2.6rem,6vw,4.8rem)] font-black leading-none tracking-tight">
              <PrivateAmount value={balance} />
            </h2>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="rounded-md bg-green-400 px-3 py-2 text-sm font-black text-black">
                +2.4%
              </span>
              <span className="text-sm font-semibold text-zinc-400">
                monthly growth
              </span>
            </div>
          </div>

          <div className="w-full rounded-lg border border-white/10 bg-white/[0.045] p-4 lg:w-[230px]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Account Status
            </p>
            <h3 className="mt-3 text-2xl font-black text-green-300">Active</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Private client since 2018. Instant settlement and card controls are online.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((item) => (
            <div key={item.label} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                {item.label}
              </p>
              <h3 className="mt-2 break-words text-lg font-black">
                {item.value}
              </h3>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Link
            href="/send"
            className="rounded-lg bg-green-400 px-5 py-4 text-center font-black text-black transition-all hover:bg-green-300 active:scale-[0.99]"
          >
            Send Money
          </Link>
          <Link
            href="/receive"
            className="rounded-lg border border-white/10 bg-white/[0.06] px-5 py-4 text-center font-black text-white transition-all hover:bg-white/[0.1] active:scale-[0.99]"
          >
            Receive
          </Link>
        </div>
      </div>
    </section>
  );
}
