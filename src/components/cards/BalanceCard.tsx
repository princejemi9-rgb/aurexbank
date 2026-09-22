"use client";

import Link from "next/link";

import { useBanking } from "../../context/BankingContext";
import { getIllustrativePresentation } from "../../lib/illustrativeHistory";
import { BalancePrivacyToggle, PrivateAmount } from "../ui/PrivateAmount";

export default function BalanceCard() {
  const { balance, currentProfile, expenses } = useBanking();
  const presentation = getIllustrativePresentation(currentProfile.fullName, currentProfile.username);
  const balanceDisplayLength = `$${balance.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`.length;
  const balanceTypeClass =
    balanceDisplayLength > 24
      ? "break-all text-[clamp(1.8rem,3.6vw,3rem)] tracking-[-0.04em]"
      : balanceDisplayLength > 17
        ? "break-words text-[clamp(2.1rem,4.5vw,3.8rem)] tracking-[-0.04em]"
        : "break-words text-[clamp(2.2rem,5vw,4rem)] tracking-tight";

  const metrics = [
    { label: "Available", value: <PrivateAmount value={balance} /> },
    { label: "Income", value: <PrivateAmount value={presentation.income} prefix="+$" maximumFractionDigits={0} minimumFractionDigits={0} />, note: "Illustrative" },
    { label: "Expenses", value: <PrivateAmount value={expenses} prefix="-$" maximumFractionDigits={0} minimumFractionDigits={0} /> },
    { label: "Reserve", value: <PrivateAmount value={presentation.reserve} maximumFractionDigits={0} minimumFractionDigits={0} />, note: "Illustrative" },
  ];

  return (
    <section className="relative overflow-hidden rounded-lg border border-green-300/20 bg-[var(--brand-surface)] p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.38)] lg:p-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-300/70 to-transparent" />

      <div className="relative z-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-green-300">
                Primary Checking
              </p>
              </div>
              <Link href="/transactions" aria-label="Open transaction history" className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-green-300/25 bg-green-400/[0.08] px-3 text-sm font-bold text-green-200 transition hover:bg-green-400/15 focus-visible:outline-2 focus-visible:outline-green-300">
                History <span aria-hidden="true">→</span>
              </Link>
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
            <h2 className={`mt-2 font-black leading-none tabular-nums ${balanceTypeClass}`}>
              <PrivateAmount value={balance} />
            </h2>

            <p className="mt-5 text-sm font-semibold text-zinc-400">Available funds</p>
          </div>

          <div className="w-full rounded-lg border border-white/10 bg-white/[0.045] p-4 lg:w-[230px]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
              Account Status
            </p>
            <h3 className="mt-3 text-2xl font-black text-green-300">Active</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">Account services and card controls are available.</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((item) => (
            <div key={item.label} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                {item.label}
              </p>
              {item.note && <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">{item.note}</p>}
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
