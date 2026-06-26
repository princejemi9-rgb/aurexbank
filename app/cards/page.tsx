"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";
import { BalancePrivacyToggle, PrivateAmount } from "../../src/components/ui/PrivateAmount";
import { useBanking } from "../../src/context/BankingContext";
import {
  getCardPreferencesServerSnapshot,
  getCardPreferencesSnapshot,
  saveCardPreferences,
  subscribeCardPreferences,
  type CardPreferences,
} from "../../src/lib/cardPreferences";

type CardModel = {
  id: string;
  type: string;
  product: string;
  holder: string;
  balance: number;
  number: string;
  expiry: string;
  cvv: string;
  color: string;
  physical: boolean;
};

function cardDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string) {
  const digits = cardDigits(value);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function lastFour(value: string) {
  return cardDigits(value).slice(-4);
}

function maskedCardNumber(value: string) {
  return `**** **** **** ${lastFour(value)}`;
}

export default function CardsPage() {
  const { balance, currentProfile, reserve, transactions } = useBanking();
  const [selectedCardId, setSelectedCardId] = useState("black");
  const [showDetails, setShowDetails] = useState(false);
  const preferences = useSyncExternalStore(
    subscribeCardPreferences,
    getCardPreferencesSnapshot,
    getCardPreferencesServerSnapshot
  );

  const cards = useMemo<CardModel[]>(
    () => [
      {
        id: "black",
        type: "Aurex Black",
        product: "Physical debit",
        holder: currentProfile.fullName,
        balance,
        number: "4582902177401188",
        expiry: "09/30",
        cvv: "428",
        color: "from-zinc-950 via-zinc-900 to-black",
        physical: true,
      },
      {
        id: "virtual",
        type: "Aurex Virtual",
        product: "Online card",
        holder: currentProfile.fullName,
        balance: reserve,
        number: "9021774058214460",
        expiry: "04/29",
        cvv: "913",
        color: "from-emerald-950 via-zinc-950 to-black",
        physical: false,
      },
    ],
    [balance, currentProfile.fullName, reserve]
  );

  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? cards[0];
  const isFrozen = preferences.frozenCards.includes(selectedCard.id);
  const displayedNumber = showDetails
    ? formatCardNumber(selectedCard.number)
    : maskedCardNumber(selectedCard.number);

  function updatePreferences(nextPreferences: CardPreferences) {
    saveCardPreferences(nextPreferences);
  }

  function setCardPreference<Key extends keyof CardPreferences>(
    key: Key,
    value: CardPreferences[Key]
  ) {
    updatePreferences({
      ...preferences,
      [key]: value,
    });
  }

  function toggleFrozen(cardId: string) {
    const frozenCards = preferences.frozenCards.includes(cardId)
      ? preferences.frozenCards.filter((id) => id !== cardId)
      : [...preferences.frozenCards, cardId];

    setCardPreference("frozenCards", frozenCards);
  }

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-[16.25rem]">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">
                Smart Card Infrastructure
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Your Cards
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Manage card security, spending limits, online payments, travel access, and recent card activity.
            </p>
            <div className="mt-4">
              <BalancePrivacyToggle />
            </div>
          </section>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
            <div className="min-w-0 space-y-6">
              <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                {cards.map((card) => {
                  const selected = selectedCard.id === card.id;
                  const frozen = preferences.frozenCards.includes(card.id);

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setSelectedCardId(card.id);
                        setShowDetails(false);
                      }}
                      className={`relative min-w-0 overflow-hidden rounded-lg border p-6 text-left shadow-2xl transition-all ${
                        selected ? "border-green-300/60" : "border-white/10"
                      } bg-gradient-to-br ${card.color}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/55">
                            Aurex Bank
                          </p>
                          <h2 className="mt-4 text-4xl font-black">VISA</h2>
                        </div>
                        <div className="text-right">
                          <div className="ml-auto rounded-lg border border-white/10 bg-white/10 p-2 text-white/65">
                            <AppIcon name="card" className="h-5 w-5" />
                          </div>
                          <span
                            className={`mt-3 inline-flex rounded-md px-3 py-1.5 text-xs font-black ${
                              frozen ? "bg-red-400/15 text-red-200" : "bg-green-400/15 text-green-200"
                            }`}
                          >
                            {frozen ? "Frozen" : "Active"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-14">
                        <p className="text-sm uppercase tracking-wide text-white/50">
                          Available Balance
                        </p>
                        <h3 className="mt-2 text-4xl font-black tracking-tight">
                          <PrivateAmount value={card.balance} maximumFractionDigits={0} minimumFractionDigits={0} />
                        </h3>
                      </div>

                      <div className="mt-8">
                        <p className="text-sm uppercase tracking-wide text-white/50">
                          Card Number
                        </p>
                        <h3 className="mt-3 break-all text-xl font-black tracking-[0.18em]">
                          {maskedCardNumber(card.number)}
                        </h3>
                      </div>

                      <div className="mt-8 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs uppercase text-white/50">Card Type</p>
                          <h3 className="mt-2 font-black">{card.type}</h3>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-white/50">Expires</p>
                          <h3 className="mt-2 font-black">{card.expiry}</h3>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <section className="bank-surface rounded-lg p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-400">Selected Card</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">{selectedCard.type}</h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      {selectedCard.product} / ending {lastFour(selectedCard.number)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-md px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
                      isFrozen ? "bg-red-400/15 text-red-200" : "bg-green-400/15 text-green-200"
                    }`}
                  >
                    {isFrozen ? "Frozen" : "Active"}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {[
                    { label: "Card Number", value: displayedNumber },
                    { label: "Expiry", value: selectedCard.expiry },
                    { label: "CVV", value: showDetails ? selectedCard.cvv : "***" },
                  ].map((item) => (
                    <div key={item.label} className="bank-panel rounded-lg p-5">
                      <p className="text-sm text-zinc-500">{item.label}</p>
                      <h3 className="mt-3 break-words text-xl font-black">{item.value}</h3>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => toggleFrozen(selectedCard.id)}
                    className={`rounded-lg p-5 text-left transition-all ${
                      isFrozen ? "bg-red-500/15 text-red-100" : "bg-white/[0.03] hover:bg-white/[0.06]"
                    } border border-white/10`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/[0.06]">
                      <AppIcon name="lock" className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-black">
                      {isFrozen ? "Unfreeze Card" : "Freeze Card"}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                      {isFrozen ? "Transactions paused" : "Transactions enabled"}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-left transition-all hover:bg-white/[0.06]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                      <AppIcon name="shield" className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-black">
                      {showDetails ? "Hide Details" : "Show Details"}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                      {showDetails ? "Sensitive data visible" : "Number and CVV masked"}
                    </p>
                  </button>

                  {[
                    {
                      title: "Online Payments",
                      checked: preferences.onlineEnabled,
                      onChange: (checked: boolean) => setCardPreference("onlineEnabled", checked),
                    },
                    {
                      title: "Contactless",
                      checked: preferences.contactlessEnabled,
                      onChange: (checked: boolean) =>
                        setCardPreference("contactlessEnabled", checked),
                    },
                  ].map((control) => (
                    <label
                      key={control.title}
                      className="rounded-lg border border-white/10 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.06]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                          <AppIcon name="activity" className="h-5 w-5" />
                        </div>
                        <input
                          type="checkbox"
                          checked={control.checked}
                          onChange={(event) => control.onChange(event.target.checked)}
                          className="mt-1 h-5 w-5 rounded border-white/20 bg-black/30 text-green-400 focus:ring-green-400"
                        />
                      </div>
                      <h3 className="mt-5 text-lg font-black">{control.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                        {control.checked ? "Enabled" : "Disabled"}
                      </p>
                    </label>
                  ))}
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Card Activity</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">Recent Transactions</h2>
                <div className="mt-6 space-y-3">
                  {transactions.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-zinc-500">
                          <AppIcon name="card" className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black">{tx.name}</h3>
                          <p className="mt-1 text-sm text-zinc-500">{tx.status} / {tx.method}</p>
                        </div>
                      </div>
                      <h3 className={`text-left text-xl font-black sm:text-right ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        <PrivateAmount
                          value={Math.abs(tx.amount)}
                          prefix={tx.amount > 0 ? "+$" : "-$"}
                          maximumFractionDigits={0}
                          minimumFractionDigits={0}
                        />
                      </h3>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="min-w-0 space-y-6">
              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Spending Controls</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Daily Limits</h2>
                <div className="mt-6 space-y-6">
                  <label className="block">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <p className="text-zinc-400">Card Purchases</p>
                      <h3 className="font-black">
                        ${preferences.cardPurchaseLimit.toLocaleString("en-US")}
                      </h3>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="50000"
                      step="1000"
                      value={preferences.cardPurchaseLimit}
                      onChange={(event) =>
                        setCardPreference("cardPurchaseLimit", Number(event.target.value))
                      }
                      className="w-full accent-green-400"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <p className="text-zinc-400">ATM Withdrawals</p>
                      <h3 className="font-black">${preferences.atmLimit.toLocaleString("en-US")}</h3>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="10000"
                      step="500"
                      value={preferences.atmLimit}
                      onChange={(event) => setCardPreference("atmLimit", Number(event.target.value))}
                      className="w-full accent-green-400"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                    <span>
                      <span className="block font-black">Travel Mode</span>
                      <span className="mt-1 block text-sm text-zinc-500">
                        {preferences.travelMode
                          ? "International usage enabled"
                          : "Domestic controls active"}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={preferences.travelMode}
                      onChange={(event) => setCardPreference("travelMode", event.target.checked)}
                      className="h-5 w-5 rounded border-white/20 bg-black/30 text-green-400 focus:ring-green-400"
                    />
                  </label>
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Aurex Secure</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Security Status</h2>
                <div className="mt-6 space-y-3">
                  {[
                    "3D Secure active",
                    isFrozen ? "Card freeze engaged" : "Real-time fraud monitoring",
                    preferences.onlineEnabled ? "Online payments allowed" : "Online payments blocked",
                    preferences.contactlessEnabled ? "Contactless enabled" : "Contactless disabled",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                      <p className="text-sm text-zinc-400">{item}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-6">
                <p className="text-sm font-semibold text-green-400">Premium Support</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Card Assistance</h2>
                <p className="mt-4 leading-relaxed text-zinc-400">
                  Dedicated support for disputes, fraud investigation, and emergency replacement services.
                </p>
                <Link
                  href="/support"
                  className="mt-6 inline-flex rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black transition-all hover:bg-green-300"
                >
                  Contact Support
                </Link>
              </section>
            </div>
          </div>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
