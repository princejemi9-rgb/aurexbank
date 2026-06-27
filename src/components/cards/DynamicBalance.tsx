"use client";

import { useBanking } from "../../context/BankingContext";
import { BalancePrivacyToggle, PrivateAmount } from "../ui/PrivateAmount";

export default function DynamicBalance() {
  const { balance } = useBanking();

  return (
    <div className="rounded-lg border border-green-300/20 bg-[var(--brand-surface)] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-400">
          Total Balance
        </p>
        <BalancePrivacyToggle />
      </div>

      <h1 className="mt-3 text-5xl font-black tracking-tight">
        <PrivateAmount value={balance} maximumFractionDigits={0} minimumFractionDigits={0} />
      </h1>

      <div className="mt-5 flex items-center gap-3">
        <div className="rounded-md bg-green-400 px-3 py-2 text-sm font-black text-black">
          +2.4%
        </div>

        <p className="text-sm font-semibold text-zinc-400">
          this month
        </p>
      </div>
    </div>
  );
}
