"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";
import { BalancePrivacyToggle, PrivateAmount } from "../../src/components/ui/PrivateAmount";
import { useBanking } from "../../src/context/BankingContext";
import {
  getBillPayPreferencesServerSnapshot,
  getBillPayPreferencesSnapshot,
  saveBillPayPreferences,
  subscribeBillPayPreferences,
} from "../../src/lib/billPayPreferences";
import {
  getCardPreferencesServerSnapshot,
  getCardPreferencesSnapshot,
  subscribeCardPreferences,
} from "../../src/lib/cardPreferences";

type PaymentMode = "bill" | "scheduled" | "beneficiary";
type StatusTone = "success" | "error" | "info";

type Biller = {
  name: string;
  category: string;
  accountLabel: string;
  delivery: string;
};

const billers: Biller[] = [
  {
    name: "Con Edison",
    category: "Utilities",
    accountLabel: "Utility account number",
    delivery: "Same day",
  },
  {
    name: "PG&E",
    category: "Utilities",
    accountLabel: "Utility account number",
    delivery: "Same day",
  },
  {
    name: "NYC Water Board",
    category: "Utilities",
    accountLabel: "Water and sewer account number",
    delivery: "1 business day",
  },
  {
    name: "AT&T Wireless",
    category: "Mobile & Internet",
    accountLabel: "Wireless account number",
    delivery: "Same day",
  },
  {
    name: "Verizon Fios",
    category: "Mobile & Internet",
    accountLabel: "Service account number",
    delivery: "Same day",
  },
  {
    name: "Xfinity",
    category: "Mobile & Internet",
    accountLabel: "Service account number",
    delivery: "Same day",
  },
  {
    name: "Spectrum",
    category: "Entertainment",
    accountLabel: "Cable account number",
    delivery: "Same day",
  },
  {
    name: "Netflix",
    category: "Entertainment",
    accountLabel: "Membership email or ID",
    delivery: "Same day",
  },
  {
    name: "Aurex Mortgage",
    category: "Mortgage & Rent",
    accountLabel: "Mortgage loan number",
    delivery: "1 business day",
  },
  {
    name: "GEICO",
    category: "Insurance",
    accountLabel: "Policy number",
    delivery: "1 business day",
  },
  {
    name: "Capital One Credit Card",
    category: "Credit Cards",
    accountLabel: "Credit card account number",
    delivery: "1 business day",
  },
  {
    name: "IRS Federal Tax",
    category: "Taxes",
    accountLabel: "Tax payment reference",
    delivery: "1 business day",
  },
  {
    name: "CityMD",
    category: "Healthcare",
    accountLabel: "Patient or statement number",
    delivery: "1 business day",
  },
  {
    name: "New York University",
    category: "Education",
    accountLabel: "Student or invoice number",
    delivery: "1 business day",
  },
];

const modes: Array<{
  id: PaymentMode;
  title: string;
  description: string;
  icon: "pay" | "activity" | "profile";
}> = [
  {
    id: "bill",
    title: "Pay a bill",
    description: "Secure one-time or recurring payments",
    icon: "pay",
  },
  {
    id: "scheduled",
    title: "Scheduled",
    description: "Review and control upcoming debits",
    icon: "activity",
  },
  {
    id: "beneficiary",
    title: "Saved billers",
    description: "Pay trusted providers faster",
    icon: "profile",
  },
];

function money(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  if (!value) return "Not selected";

  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function localDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

export default function PaymentsPage() {
  const { balance, currentProfile, submitTransfer, transactions } = useBanking();
  const cardPreferences = useSyncExternalStore(
    subscribeCardPreferences,
    getCardPreferencesSnapshot,
    getCardPreferencesServerSnapshot
  );
  const billPayPreferences = useSyncExternalStore(
    subscribeBillPayPreferences,
    getBillPayPreferencesSnapshot,
    getBillPayPreferencesServerSnapshot
  );

  const [mode, setMode] = useState<PaymentMode>("bill");
  const [category, setCategory] = useState("Utilities");
  const [provider, setProvider] = useState("Con Edison");
  const [accountNumber, setAccountNumber] = useState("CE-8041-2298");
  const [amount, setAmount] = useState("1250");
  const [source, setSource] = useState("Checking Account");
  const [timing, setTiming] = useState<"now" | "scheduled">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [frequency, setFrequency] = useState("Once");
  const [deliverySpeed, setDeliverySpeed] = useState("Standard");
  const [memo, setMemo] = useState("Monthly utility payment");
  const [saveBiller, setSaveBiller] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [confirmation, setConfirmation] = useState("");

  const categories = useMemo(
    () => Array.from(new Set(billers.map((biller) => biller.category))),
    []
  );
  const categoryBillers = useMemo(
    () => billers.filter((biller) => biller.category === category),
    [category]
  );
  const selectedBiller =
    billers.find((biller) => biller.name === provider) ?? categoryBillers[0] ?? billers[0];
  const paymentAmount = Number(amount);
  const validAmount = Number.isFinite(paymentAmount) && paymentAmount > 0;
  const fee = timing === "now" && deliverySpeed === "Express" ? 1.5 : 0;
  const totalDebit = validAmount ? paymentAmount + fee : fee;
  const hasEnoughBalance = totalDebit <= balance;
  const balanceAfter = hasEnoughBalance ? balance - totalDebit : balance;
  const payingWithBlackCard = source === "Aurex Black Card";
  const blackCardFrozen = cardPreferences.frozenCards.includes("black");
  const cardPaymentBlocked =
    payingWithBlackCard &&
    (blackCardFrozen ||
      !cardPreferences.onlineEnabled ||
      totalDebit > cardPreferences.cardPurchaseLimit);
  const paymentTransactions = transactions
    .filter((transaction) => transaction.type.toLowerCase().includes("payment"))
    .slice(0, 5);

  function showStatus(message: string, tone: StatusTone) {
    setStatus(message);
    setStatusTone(tone);
  }

  function chooseCategory(nextCategory: string) {
    const firstBiller = billers.find((biller) => biller.category === nextCategory);
    setCategory(nextCategory);
    if (firstBiller) setProvider(firstBiller.name);
  }

  function chooseSavedBiller(name: string, savedCategory: string, accountEnding: string) {
    setCategory(savedCategory);
    setProvider(name);
    setAccountNumber(`•••• ${accountEnding}`);
    setMode("bill");
    setStatus("");
    setConfirmation("");
  }

  function openScheduler() {
    setTiming("scheduled");
    setMode("bill");
    setStatus("");
    setConfirmation("");
  }

  function validatePayment() {
    if (!provider.trim()) return "Choose a biller.";
    if (accountNumber.trim().replace(/\s/g, "").length < 4) {
      return `Enter a valid ${selectedBiller.accountLabel.toLowerCase()}.`;
    }
    if (!validAmount) return "Enter a valid payment amount.";
    if (totalDebit > 10_000_000) {
      return "Bill payments are limited to $10,000,000.00 per transaction.";
    }
    if (timing === "now" && !hasEnoughBalance) return "Insufficient available balance.";
    if (timing === "scheduled" && (!scheduleDate || scheduleDate < localDate())) {
      return "Choose today or a future payment date.";
    }
    if (cardPaymentBlocked) {
      if (blackCardFrozen) {
        return "Aurex Black Card is frozen. Unfreeze it before paying from this card.";
      }
      if (!cardPreferences.onlineEnabled) return "Online card payments are disabled.";
      return `This payment exceeds the $${money(
        cardPreferences.cardPurchaseLimit
      )} card purchase limit.`;
    }

    return "";
  }

  function reviewPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmation("");
    const error = validatePayment();

    if (error) {
      showStatus(error, "error");
      return;
    }

    setStatus("");
    setReviewOpen(true);
  }

  function saveCurrentBiller() {
    if (!saveBiller) return;

    const accountEnding = accountNumber.replace(/\D/g, "").slice(-4) || "0000";
    const withoutCurrent = billPayPreferences.savedBillers.filter(
      (biller) => biller.name !== provider
    );

    saveBillPayPreferences({
      ...billPayPreferences,
      savedBillers: [
        {
          id: `saved-${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          name: provider,
          category,
          accountEnding,
        },
        ...withoutCurrent,
      ].slice(0, 12),
    });
  }

  async function submitPayment() {
    const error = validatePayment();
    if (error) {
      showStatus(error, "error");
      setReviewOpen(false);
      return;
    }

    setProcessing(true);
    setStatus("");

    try {
      const confirmationNumber = `BP-${Date.now().toString().slice(-10)}`;

      if (timing === "scheduled") {
        const accountEnding = accountNumber.replace(/\D/g, "").slice(-4) || "0000";
        saveBillPayPreferences({
          savedBillers: saveBiller
            ? [
                {
                  id: `saved-${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                  name: provider,
                  category,
                  accountEnding,
                },
                ...billPayPreferences.savedBillers.filter(
                  (biller) => biller.name !== provider
                ),
              ].slice(0, 12)
            : billPayPreferences.savedBillers,
          scheduledPayments: [
            {
              id: confirmationNumber,
              biller: provider,
              amount: paymentAmount,
              date: scheduleDate,
              frequency,
              accountEnding,
              status: "Active" as const,
            },
            ...billPayPreferences.scheduledPayments,
          ].slice(0, 20),
        });
        setConfirmation(confirmationNumber);
        showStatus(
          `${provider} is scheduled for ${formatDate(scheduleDate)}. No funds were debited today.`,
          "success"
        );
        setMode("scheduled");
      } else {
        const result = await submitTransfer({
          transferType: "payment",
          accountType: source,
          receiver: provider,
          amount: totalDebit,
          transferAmount: paymentAmount,
          fee,
          totalDebit,
          reference: confirmationNumber,
          accountNumber,
          bankName: `Aurex Bill Pay · ${deliverySpeed}`,
          memo,
          transferPurpose: `${category} bill payment`,
        });

        if (!result.ok) {
          showStatus(result.message, "error");
          return;
        }

        saveCurrentBiller();
        setConfirmation(confirmationNumber);
        showStatus(
          `${provider} was paid successfully. Confirmation ${confirmationNumber}.`,
          "success"
        );
      }
    } catch {
      showStatus("Unable to submit this payment. Check your connection and try again.", "error");
    } finally {
      setProcessing(false);
      setReviewOpen(false);
    }
  }

  function toggleSchedule(id: string) {
    saveBillPayPreferences({
      ...billPayPreferences,
      scheduledPayments: billPayPreferences.scheduledPayments.map((payment) =>
        payment.id === id
          ? {
              ...payment,
              status: payment.status === "Active" ? "Paused" : "Active",
            }
          : payment
      ),
    });
  }

  function cancelSchedule(id: string) {
    saveBillPayPreferences({
      ...billPayPreferences,
      scheduledPayments: billPayPreferences.scheduledPayments.filter(
        (payment) => payment.id !== id
      ),
    });
    showStatus("Scheduled payment cancelled.", "info");
  }

  function removeSavedBiller(id: string) {
    saveBillPayPreferences({
      ...billPayPreferences,
      savedBillers: billPayPreferences.savedBillers.filter((biller) => biller.id !== id),
    });
    showStatus("Saved biller removed.", "info");
  }

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content desktop-page-content">
        <div className="app-inner">
          <section className="bank-surface mb-5 rounded-lg p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
                    Secure Bill Pay
                  </p>
                </div>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Pay bills with confidence
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                  Pay verified providers now, schedule recurring bills, and manage saved accounts
                  from one protected workspace.
                </p>
              </div>
              <div className="shrink-0 rounded-lg border border-green-300/15 bg-green-400/[0.06] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Available
                </p>
                <p className="mt-1 max-w-[16rem] truncate text-xl font-black sm:text-2xl">
                  <PrivateAmount value={balance} />
                </p>
              </div>
            </div>
            <div className="mt-4">
              <BalancePrivacyToggle />
            </div>
          </section>

          <section className="mb-5 grid min-w-0 gap-3 md:grid-cols-3">
            {modes.map((item) => {
              const count =
                item.id === "scheduled"
                  ? billPayPreferences.scheduledPayments.length
                  : item.id === "beneficiary"
                    ? billPayPreferences.savedBillers.length
                    : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMode(item.id);
                    setStatus("");
                  }}
                  className={`bank-surface flex min-h-24 items-center gap-4 rounded-lg p-4 text-left transition-colors ${
                    mode === item.id ? "border-green-300/45 bg-green-400/[0.07]" : ""
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-400/10 text-green-300">
                    <AppIcon name={item.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-black">{item.title}</span>
                      {count !== null && (
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-black text-zinc-400">
                          {count}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </section>

          {status && (
            <div
              role="status"
              className={`mb-5 rounded-lg border px-4 py-3 text-sm font-semibold ${
                statusTone === "success"
                  ? "border-green-300/25 bg-green-400/[0.08] text-green-100"
                  : statusTone === "error"
                    ? "border-red-300/25 bg-red-400/[0.08] text-red-100"
                    : "border-white/10 bg-white/[0.035] text-zinc-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <AppIcon
                  name={statusTone === "success" ? "check" : statusTone === "error" ? "close" : "activity"}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <p className="min-w-0 break-words">
                  {status}
                  {confirmation && timing === "now" && (
                    <span className="mt-1 block text-xs text-zinc-400">
                      The completed debit is now in your payment activity.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {mode === "bill" && (
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <form onSubmit={reviewPayment} className="bank-surface min-w-0 rounded-lg p-5 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-400">New bill payment</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                      Payment details
                    </h2>
                  </div>
                  <span className="w-fit rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-400">
                    256-bit protected
                  </span>
                </div>

                <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
                  <label className="block min-w-0">
                    <span className="text-sm text-zinc-400">Bill category</span>
                    <select
                      value={category}
                      onChange={(event) => chooseCategory(event.target.value)}
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400/40"
                    >
                      {categories.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="text-sm text-zinc-400">Verified biller</span>
                    <select
                      value={provider}
                      onChange={(event) => setProvider(event.target.value)}
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400/40"
                    >
                      {categoryBillers.map((biller) => (
                        <option key={biller.name}>{biller.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="text-sm text-zinc-400">{selectedBiller.accountLabel}</span>
                    <input
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value.slice(0, 40))}
                      autoComplete="off"
                      inputMode="text"
                      placeholder={selectedBiller.accountLabel}
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                    />
                  </label>

                  <label className="block min-w-0">
                    <span className="text-sm text-zinc-400">Amount</span>
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-500">
                        $
                      </span>
                      <input
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        type="number"
                        min="0.01"
                        max="10000000"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-12 w-full rounded-lg border border-white/10 bg-black/30 pl-8 pr-4 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                      />
                    </div>
                  </label>

                  <label className="block min-w-0">
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

                  <fieldset className="min-w-0">
                    <legend className="text-sm text-zinc-400">When to pay</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {[
                        { id: "now" as const, label: "Pay now" },
                        { id: "scheduled" as const, label: "Schedule" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setTiming(item.id)}
                          className={`h-12 rounded-lg border text-sm font-black ${
                            timing === item.id
                              ? "border-green-300/40 bg-green-400/10 text-green-200"
                              : "border-white/10 bg-black/30 text-zinc-400"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {timing === "scheduled" ? (
                    <>
                      <label className="block min-w-0">
                        <span className="text-sm text-zinc-400">First payment date</span>
                        <input
                          value={scheduleDate}
                          onChange={(event) => setScheduleDate(event.target.value)}
                          type="date"
                          min={localDate()}
                          className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400/40"
                        />
                      </label>
                      <label className="block min-w-0">
                        <span className="text-sm text-zinc-400">Frequency</span>
                        <select
                          value={frequency}
                          onChange={(event) => setFrequency(event.target.value)}
                          className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400/40"
                        >
                          <option>Once</option>
                          <option>Weekly</option>
                          <option>Monthly</option>
                          <option>Quarterly</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <label className="block min-w-0 sm:col-span-2">
                      <span className="text-sm text-zinc-400">Delivery speed</span>
                      <select
                        value={deliverySpeed}
                        onChange={(event) => setDeliverySpeed(event.target.value)}
                        className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400/40"
                      >
                        <option>Standard</option>
                        <option>Express</option>
                      </select>
                      <span className="mt-2 block text-xs text-zinc-600">
                        Standard is free. Express adds a $1.50 processing fee.
                      </span>
                    </label>
                  )}
                </div>

                <label className="mt-4 block min-w-0">
                  <span className="text-sm text-zinc-400">Memo or invoice note</span>
                  <textarea
                    value={memo}
                    onChange={(event) => setMemo(event.target.value.slice(0, 140))}
                    maxLength={140}
                    className="mt-2 h-24 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none focus:border-green-400/40"
                  />
                  <span className="mt-1 block text-right text-xs text-zinc-600">
                    {memo.length}/140
                  </span>
                </label>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
                  <input
                    checked={saveBiller}
                    onChange={(event) => setSaveBiller(event.target.checked)}
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-green-400"
                  />
                  <span>
                    <span className="block text-sm font-black">Save this biller</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      Store only the provider and last four account digits for faster payments.
                    </span>
                  </span>
                </label>

                <button
                  type="submit"
                  className="mt-5 w-full rounded-lg bg-green-400 px-6 py-4 text-sm font-black text-black transition-colors hover:bg-green-300 sm:w-auto"
                >
                  Review payment
                </button>
              </form>

              <aside className="min-w-0 space-y-5">
                <section className="rounded-lg border border-green-300/15 bg-[var(--brand-surface)] p-5">
                  <p className="text-sm font-semibold text-green-400">Payment summary</p>
                  <h2 className="mt-2 max-w-full truncate text-3xl font-black tracking-tight">
                    <PrivateAmount value={validAmount ? totalDebit : 0} />
                  </h2>
                  <div className="mt-5 space-y-3">
                    {[
                      { label: "Biller", value: provider },
                      {
                        label: "Delivery",
                        value:
                          timing === "scheduled"
                            ? scheduleDate
                              ? formatDate(scheduleDate)
                              : "Select a date"
                            : selectedBiller.delivery,
                      },
                      { label: "Fee", value: `$${money(fee)}` },
                      {
                        label: "Balance after",
                        value: `$${money(balanceAfter)}`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex min-w-0 items-center justify-between gap-4 border-b border-white/[0.07] pb-3 last:border-0 last:pb-0"
                      >
                        <span className="shrink-0 text-sm text-zinc-500">{item.label}</span>
                        <span className="min-w-0 truncate text-right text-sm font-black">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bank-surface rounded-lg p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-400/10 text-green-300">
                      <AppIcon name="shield" className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-black">Aurex payment protection</h2>
                      <p className="mt-0.5 text-xs text-zinc-500">Verified biller network</p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-3 text-sm text-zinc-400">
                    <li className="flex gap-2">
                      <AppIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                      Fraud and duplicate-payment screening
                    </li>
                    <li className="flex gap-2">
                      <AppIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                      Confirmation reference for every payment
                    </li>
                    <li className="flex gap-2">
                      <AppIcon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                      Account numbers are masked after saving
                    </li>
                  </ul>
                </section>
              </aside>
            </div>
          )}

          {mode === "scheduled" && (
            <section className="bank-surface rounded-lg p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-400">Payment calendar</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    Scheduled payments
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={openScheduler}
                  className="rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black"
                >
                  Schedule a bill
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {billPayPreferences.scheduledPayments.length ? (
                  billPayPreferences.scheduledPayments.map((payment) => (
                    <article
                      key={payment.id}
                      className="grid min-w-0 gap-4 rounded-lg border border-white/10 bg-black/20 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-black">{payment.biller}</h3>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                              payment.status === "Active"
                                ? "bg-green-400/10 text-green-300"
                                : "bg-amber-400/10 text-amber-200"
                            }`}
                          >
                            {payment.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatDate(payment.date)} · {payment.frequency} · Account ••••{" "}
                          {payment.accountEnding}
                        </p>
                      </div>
                      <p className="text-xl font-black md:text-right">
                        <PrivateAmount value={payment.amount} />
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSchedule(payment.id)}
                          className="bank-button rounded-lg px-4 py-2.5 text-xs font-black"
                        >
                          {payment.status === "Active" ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelSchedule(payment.id)}
                          className="rounded-lg border border-red-300/15 bg-red-400/[0.05] px-4 py-2.5 text-xs font-black text-red-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
                    <p className="font-black">No scheduled bills</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Future and recurring payments will appear here.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {mode === "beneficiary" && (
            <section className="bank-surface rounded-lg p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-400">Trusted providers</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    Saved billers
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setMode("bill")}
                  className="rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black"
                >
                  Add a biller
                </button>
              </div>

              <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {billPayPreferences.savedBillers.length ? (
                  billPayPreferences.savedBillers.map((biller) => (
                    <article
                      key={biller.id}
                      className="rounded-lg border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-400/10 text-green-300">
                          <AppIcon name="pay" className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black">{biller.name}</h3>
                          <p className="mt-1 text-sm text-zinc-500">
                            {biller.category} · •••• {biller.accountEnding}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            chooseSavedBiller(
                              biller.name,
                              biller.category,
                              biller.accountEnding
                            )
                          }
                          className="rounded-lg bg-green-400 px-4 py-2.5 text-xs font-black text-black"
                        >
                          Pay
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSavedBiller(biller.id)}
                          className="bank-button rounded-lg px-4 py-2.5 text-xs font-black text-zinc-300"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center md:col-span-2 xl:col-span-3">
                    <p className="font-black">No saved billers</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      Save a provider during your next payment.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="bank-surface mt-5 rounded-lg p-5 sm:p-6">
            <p className="text-sm font-semibold text-green-400">Settlement history</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              Recent bill payments
            </h2>
            <div className="mt-5 space-y-3">
              {paymentTransactions.length ? (
                paymentTransactions.map((item) => (
                  <div
                    key={item.id}
                    className="grid min-w-0 gap-2 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <h3 className="truncate font-black">{item.name}</h3>
                      <p className="mt-1 truncate text-sm text-zinc-500">
                        {item.time} · {item.method} · {item.status}
                      </p>
                    </div>
                    <p className="text-lg font-black text-red-300 sm:text-right">
                      <PrivateAmount
                        value={Math.abs(item.amount)}
                        prefix="-$"
                        minimumFractionDigits={2}
                        maximumFractionDigits={2}
                      />
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                  Your completed bill payments will appear here.
                </div>
              )}
            </div>
          </section>

          {reviewOpen && (
            <div
              className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-review-title"
            >
              <section className="bank-surface max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-green-400">Final review</p>
                    <h2
                      id="payment-review-title"
                      className="mt-1 text-2xl font-black tracking-tight"
                    >
                      Confirm bill payment
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close payment review"
                    onClick={() => setReviewOpen(false)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]"
                  >
                    <AppIcon name="close" className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-5 max-w-full truncate text-4xl font-black">
                  <PrivateAmount value={totalDebit} />
                </p>
                <div className="mt-5 space-y-3">
                  {[
                    { label: "Biller", value: provider },
                    {
                      label: "Account",
                      value: `•••• ${accountNumber.replace(/\D/g, "").slice(-4) || "0000"}`,
                    },
                    { label: "Source", value: source },
                    {
                      label: "Timing",
                      value:
                        timing === "now"
                          ? `${deliverySpeed} · ${selectedBiller.delivery}`
                          : `${formatDate(scheduleDate)} · ${frequency}`,
                    },
                    { label: "Payment fee", value: `$${money(fee)}` },
                    { label: "Memo", value: memo || "No memo" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex min-w-0 items-start justify-between gap-4 rounded-lg border border-white/[0.08] bg-black/20 p-3"
                    >
                      <span className="shrink-0 text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
                        {item.label}
                      </span>
                      <span className="min-w-0 break-words text-right text-sm font-black">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                {timing === "scheduled" && (
                  <p className="mt-4 rounded-lg border border-blue-300/15 bg-blue-400/[0.06] p-3 text-xs leading-relaxed text-blue-100">
                    This creates an upcoming payment. Your available balance will not change until
                    the scheduled debit is processed.
                  </p>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewOpen(false)}
                    className="bank-button rounded-lg py-3.5 text-sm font-black text-zinc-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={submitPayment}
                    disabled={processing}
                    className="rounded-lg bg-green-400 py-3.5 text-sm font-black text-black disabled:cursor-wait disabled:opacity-60"
                  >
                    {processing
                      ? "Processing..."
                      : timing === "scheduled"
                        ? "Confirm schedule"
                        : "Pay bill"}
                  </button>
                </div>
              </section>
            </div>
          )}

          <footer className="mt-5 text-center text-xs text-zinc-600">
            Signed in as {currentProfile.email} · Bill Pay protected by Aurex Secure
          </footer>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
