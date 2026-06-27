"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";
import { BalancePrivacyToggle, PrivateAmount } from "../../src/components/ui/PrivateAmount";
import { useBanking } from "../../src/context/BankingContext";
import {
  getCardPreferencesServerSnapshot,
  getCardPreferencesSnapshot,
  subscribeCardPreferences,
} from "../../src/lib/cardPreferences";

type PaymentMode = "bill" | "scheduled" | "beneficiary";

const paymentModes: Array<{
  id: PaymentMode;
  title: string;
  desc: string;
  icon: "wallet" | "activity" | "profile";
}> = [
  { id: "bill", title: "Pay Bills", desc: "Utilities, subscriptions, rent", icon: "wallet" },
  { id: "scheduled", title: "Schedule", desc: "Recurring and future payments", icon: "activity" },
  { id: "beneficiary", title: "Beneficiaries", desc: "Trusted recipients", icon: "profile" },
];

const trustedBillers = [
  "Eko Electricity",
  "Lagos Water",
  "Aurex Home Loan",
  "MTN Postpaid",
  "Netflix",
];

function money(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export default function PaymentsPage() {
  const { balance, submitTransfer, transactions } = useBanking();
  const cardPreferences = useSyncExternalStore(
    subscribeCardPreferences,
    getCardPreferencesSnapshot,
    getCardPreferencesServerSnapshot
  );
  const [mode, setMode] = useState<PaymentMode>("bill");
  const [recipient, setRecipient] = useState("Eko Electricity");
  const [amount, setAmount] = useState("1250");
  const [source, setSource] = useState("Checking Account");
  const [schedule, setSchedule] = useState("Instant");
  const [memo, setMemo] = useState("June utility payment");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);

  const paymentAmount = Number(amount);
  const validAmount = Number.isFinite(paymentAmount) && paymentAmount > 0;
  const fee = schedule === "Instant" ? 0 : 1.5;
  const totalDebit = validAmount ? paymentAmount + fee : fee;
  const balanceAfter = Math.max(balance - totalDebit, 0);
  const payingWithBlackCard = source === "Aurex Black Card";
  const blackCardFrozen = cardPreferences.frozenCards.includes("black");
  const cardPaymentBlocked =
    payingWithBlackCard &&
    (blackCardFrozen ||
      !cardPreferences.onlineEnabled ||
      totalDebit > cardPreferences.cardPurchaseLimit);
  const paymentRails = [
    { label: "ACH", status: "Active", blocked: false },
    {
      label: "Card Network",
      status: blackCardFrozen
        ? "Frozen"
        : cardPreferences.onlineEnabled
          ? "Active"
          : "Online blocked",
      blocked: blackCardFrozen || !cardPreferences.onlineEnabled,
    },
    { label: "Wire", status: "Active", blocked: false },
    { label: "Crypto", status: "Active", blocked: false },
  ];

  const filteredBillers = useMemo(
    () =>
      trustedBillers.filter((biller) =>
        biller.toLowerCase().includes(recipient.toLowerCase())
      ),
    [recipient]
  );

  function reviewPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (!recipient.trim()) {
      setStatus("Enter a recipient or biller.");
      return;
    }

    if (!validAmount) {
      setStatus("Enter a valid payment amount.");
      return;
    }

    if (cardPaymentBlocked) {
      setStatus(
        blackCardFrozen
          ? "Aurex Black Card is frozen. Unfreeze it before paying from this card."
          : !cardPreferences.onlineEnabled
            ? "Online card payments are disabled."
            : `This payment exceeds the $${money(cardPreferences.cardPurchaseLimit)} card purchase limit.`
      );
      return;
    }

    setReviewOpen(true);
  }

  async function submitPayment() {
    if (!validAmount) return;

    if (cardPaymentBlocked) {
      setStatus(
        blackCardFrozen
          ? "Aurex Black Card is frozen. Unfreeze it before paying from this card."
          : !cardPreferences.onlineEnabled
            ? "Online card payments are disabled."
            : `This payment exceeds the $${money(cardPreferences.cardPurchaseLimit)} card purchase limit.`
      );
      setReviewOpen(false);
      return;
    }

    setProcessing(true);
    setStatus("");

    try {
      const result = await submitTransfer({
        transferType: "payment",
        accountType: source,
        receiver: recipient,
        amount: totalDebit,
        bankName: schedule,
      });

      setStatus(
        result.ok
          ? `${recipient} payment submitted. Total debit: $${money(totalDebit)}.`
          : result.message
      );
    } catch {
      setStatus("Unable to submit payment. Please check your connection and try again.");
    } finally {
      setProcessing(false);
      setReviewOpen(false);
    }
  }

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-72">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                Payment Operations
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Payments
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Pay billers, schedule future debits, and review settlements before money leaves your account.
            </p>
            <div className="mt-4">
              <BalancePrivacyToggle />
            </div>
          </section>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <div className="min-w-0 space-y-6">
              <section className="grid min-w-0 gap-4 md:grid-cols-3">
                {paymentModes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={`bank-surface rounded-lg p-5 text-left transition-all hover:bg-white/[0.055] ${
                      mode === item.id ? "border-green-300/50" : ""
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                      <AppIcon name={item.icon} className="h-5 w-5" />
                    </div>
                    <h2 className="mt-5 text-xl font-black">{item.title}</h2>
                    <p className="mt-2 text-sm text-zinc-500">{item.desc}</p>
                  </button>
                ))}
              </section>

              <form onSubmit={reviewPayment} className="bank-surface rounded-lg p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-400">Payment Console</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">New Payment</h2>
                  </div>
                  <span className="w-fit rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">
                    {mode}
                  </span>
                </div>

                <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-zinc-400">Recipient or biller</span>
                    <input
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      placeholder="Recipient or biller"
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-400">Amount</span>
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="Amount"
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-400">Pay from</span>
                    <select
                      value={source}
                      onChange={(event) => setSource(event.target.value)}
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400/40"
                    >
                      <option>Checking Account</option>
                      <option>Savings Account</option>
                      <option>Aurex Black Card</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-zinc-400">Timing</span>
                    <select
                      value={schedule}
                      onChange={(event) => setSchedule(event.target.value)}
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400/40"
                    >
                      <option>Instant</option>
                      <option>Schedule for later</option>
                      <option>Monthly recurring</option>
                    </select>
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="text-sm text-zinc-400">Memo</span>
                  <textarea
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                    className="mt-2 h-28 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                  />
                </label>

                {recipient && filteredBillers.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {filteredBillers.slice(0, 4).map((biller) => (
                      <button
                        key={biller}
                        type="button"
                        onClick={() => setRecipient(biller)}
                        className="bank-button rounded-lg px-3 py-2 text-xs font-black text-zinc-300"
                      >
                        {biller}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  className="mt-6 rounded-lg bg-green-400 px-6 py-4 text-sm font-black text-black transition-all hover:bg-green-300"
                >
                  Review Payment
                </button>

                {status && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-zinc-300">
                    {status}
                  </div>
                )}
              </form>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Settlement History</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">Recent Payment Activity</h2>
                <div className="mt-6 space-y-3">
                  {transactions.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black">{item.name}</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          {item.method} / {item.status}
                        </p>
                      </div>
                      <p
                        className={`text-left text-lg font-black sm:text-right ${
                          item.amount > 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        <PrivateAmount
                          value={Math.abs(item.amount)}
                          prefix={item.amount > 0 ? "+$" : "-$"}
                          maximumFractionDigits={0}
                          minimumFractionDigits={0}
                        />
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="min-w-0 space-y-6">
              <section className="rounded-lg border border-green-300/15 bg-[#07120d] p-6 shadow-2xl">
                <p className="text-sm font-semibold text-green-400">Available Balance</p>
                <h2 className="mt-3 break-words text-4xl font-black tracking-tight">
                  <PrivateAmount value={balance} />
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Payments route through Aurex Secure with real-time fraud monitoring.
                </p>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Review Summary</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  <PrivateAmount value={validAmount ? totalDebit : 0} />
                </h2>
                <div className="mt-6 space-y-3">
                  {[
                    {
                      label: "Payment",
                      value: <PrivateAmount value={validAmount ? paymentAmount : 0} />,
                    },
                    { label: "Fee", value: <PrivateAmount value={fee} /> },
                    { label: "Balance after", value: <PrivateAmount value={balanceAfter} /> },
                    { label: "Timing", value: schedule },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-4"
                    >
                      <p className="min-w-0 truncate text-sm text-zinc-500">{item.label}</p>
                      <h3 className="shrink-0 text-right text-sm font-black">{item.value}</h3>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Payment Health</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Rails Online</h2>
                <div className="mt-6 space-y-3">
                  {paymentRails.map((rail) => (
                    <div
                      key={rail.label}
                      className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-4"
                    >
                      <p className="min-w-0 truncate font-semibold">{rail.label}</p>
                      <span
                        className={`shrink-0 text-sm font-black ${
                          rail.blocked ? "text-red-200" : "text-green-400"
                        }`}
                      >
                        {rail.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>

          {reviewOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
              <section className="bank-surface w-full max-w-lg rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Confirm Payment</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  <PrivateAmount value={totalDebit} />
                </h2>
                <div className="mt-6 space-y-3">
                  {[
                    { label: "Recipient", value: recipient },
                    { label: "Source", value: source },
                    { label: "Timing", value: schedule },
                    { label: "Memo", value: memo || "No memo" },
                  ].map((item) => (
                    <div key={item.label} className="bank-panel rounded-lg p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                        {item.label}
                      </p>
                      <h3 className="mt-2 break-words font-black">{item.value}</h3>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setReviewOpen(false)}
                    className="bank-button rounded-lg py-4 text-sm font-black text-zinc-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={submitPayment}
                    disabled={processing}
                    className="rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-60"
                  >
                    {processing ? "Submitting..." : "Submit Payment"}
                  </button>
                </div>
              </section>
            </div>
          )}

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
