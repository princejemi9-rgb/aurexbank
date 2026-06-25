"use client";

import Link from "next/link";

import { useBanking } from "../../context/BankingContext";
import AppIcon from "../ui/AppIcon";
import { PrivateAmount } from "../ui/PrivateAmount";

const scheduledPayments = [
  {
    title: "Mortgage autopay",
    detail: "Aurex Home Loan",
    due: "Jun 10",
    amount: 2800,
    icon: "bank" as const,
    status: "Scheduled",
  },
  {
    title: "Card statement",
    detail: "Aurex Black minimum payment",
    due: "Jun 12",
    amount: 740,
    icon: "card" as const,
    status: "Ready",
  },
  {
    title: "Reserve transfer",
    detail: "Monthly wealth reserve",
    due: "Jun 14",
    amount: 1200,
    icon: "wallet" as const,
    status: "Automated",
  },
];
const paymentReadiness = [
  { label: "Autopay Rules", value: "3 active" },
  { label: "Reserve Hold", value: "Enabled" },
  { label: "Review Window", value: "24/7" },
];

export default function UpcomingPayments() {
  const { balance } = useBanking();
  const scheduledTotal = scheduledPayments.reduce((total, payment) => total + payment.amount, 0);
  const balanceAfterPayments = Math.max(balance - scheduledTotal, 0);

  return (
    <section className="bank-surface flex min-w-0 flex-col rounded-lg p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-400">
            Cashflow Control
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Upcoming Payments</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Scheduled debits reserved against your available balance.
          </p>
        </div>
        <Link
          href="/payments"
          className="bank-button inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold"
        >
          Manage
        </Link>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)]">
        <div className="bank-panel min-w-0 rounded-lg p-5">
          <p className="text-sm text-zinc-500">Next 7 days</p>
          <h3 className="mt-3 text-4xl font-black tracking-tight">
            <PrivateAmount value={scheduledTotal} maximumFractionDigits={0} minimumFractionDigits={0} />
          </h3>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/45">
            <div className="h-full w-[68%] rounded-full bg-green-400" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            Autopay is ready and cash coverage is available for all scheduled items.
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          {scheduledPayments.map((payment) => (
            <div
              key={payment.title}
              className="grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/[0.055] text-green-300">
                  <AppIcon name={payment.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black">{payment.title}</h3>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {payment.detail} / {payment.due}
                  </p>
                </div>
              </div>
              <div className="min-w-0 text-left sm:text-right">
                <h3 className="text-base font-black">
                  <PrivateAmount value={payment.amount} maximumFractionDigits={0} minimumFractionDigits={0} />
                </h3>
                <p className="mt-1 break-words text-[11px] font-bold uppercase tracking-[0.14em] text-green-400">
                  {payment.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="bank-panel rounded-lg p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
            After Scheduled
          </p>
          <h3 className="mt-2 text-2xl font-black">
            <PrivateAmount value={balanceAfterPayments} maximumFractionDigits={0} minimumFractionDigits={0} />
          </h3>
        </div>
        <div className="bank-panel rounded-lg p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
            Coverage
          </p>
          <h3 className="mt-2 text-2xl font-black text-green-400">Healthy</h3>
        </div>
      </div>

      <div className="mt-auto grid gap-3 pt-3 sm:grid-cols-3">
        {paymentReadiness.map((item) => (
          <div key={item.label} className="rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              {item.label}
            </p>
            <h3 className="mt-2 text-lg font-black text-zinc-100">{item.value}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
