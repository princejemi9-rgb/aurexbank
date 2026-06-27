"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { supabase } from "../../lib/supabase";
import {
  getCardPreferencesServerSnapshot,
  getCardPreferencesSnapshot,
  saveCardPreferences,
  subscribeCardPreferences,
  type CardPreferences,
} from "../../lib/cardPreferences";
import { useBanking } from "../../context/BankingContext";
import AppIcon from "../ui/AppIcon";
import { PrivateAmount } from "../ui/PrivateAmount";

type CardRecord = {
  card_number: string;
  username: string;
  expiry: string;
  cvv: string;
};

function cardDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCardNumber(value: string) {
  const digits = cardDigits(value);
  return digits.replace(/(.{4})/g, "$1 ").trim() || value;
}

function lastFour(value: string) {
  const digits = cardDigits(value);
  return digits.slice(-4) || "0000";
}

export default function LiveCard() {
  const { currentProfile } = useBanking();
  const channelId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [liveCard, setCard] = useState<CardRecord | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const preferences = useSyncExternalStore(
    subscribeCardPreferences,
    getCardPreferencesSnapshot,
    getCardPreferencesServerSnapshot
  );
  const primaryCardId = "black";

  useEffect(() => {
    let active = true;
    const username = currentProfile.username;

    async function fetchCard(): Promise<CardRecord | null> {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data } = await supabase
        .from("cards")
        .select("card_number, username, expiry, cvv")
        .eq("username", username)
        .limit(1);

      return data?.[0] ?? null;
    }

    async function loadCard() {
      const nextCard = await fetchCard();

      if (active && nextCard) {
        setCard(nextCard);
      }
    }

    loadCard();

    const channel = supabase
      .channel(`card-live-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cards",
        },
        () => {
          loadCard();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [channelId, currentProfile.username]);

  const card = liveCard ?? {
    card_number: "4582902177401188",
    username: currentProfile.username,
    expiry: "09/30",
    cvv: "428",
  };

  const display = useMemo(() => {
    const number = showDetails
      ? formatCardNumber(card.card_number)
      : `**** **** **** ${lastFour(card.card_number)}`;

    return {
      number,
      cvv: showDetails ? card.cvv : "***",
      holder: currentProfile.fullName,
      lastFour: lastFour(card.card_number),
    };
  }, [card.card_number, card.cvv, currentProfile.fullName, showDetails]);

  const frozen = preferences.frozenCards.includes(primaryCardId);
  const cardCapabilities = [
    preferences.onlineEnabled ? "Online" : "Online blocked",
    preferences.contactlessEnabled ? "tap ready" : "tap blocked",
    "3DS ready",
  ].join(" / ");

  function updatePreferences(nextPreferences: CardPreferences) {
    saveCardPreferences(nextPreferences);
  }

  function toggleFrozen() {
    const frozenCards = frozen
      ? preferences.frozenCards.filter((cardId) => cardId !== primaryCardId)
      : [...preferences.frozenCards, primaryCardId];

    updatePreferences({
      ...preferences,
      frozenCards,
    });
  }

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-lg border border-green-300/15 bg-gradient-to-br from-zinc-950 via-emerald-950 to-black p-4 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-6 lg:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-200/60 to-transparent" />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/55">
                Aurex Bank
              </p>
              <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">VISA</h2>
            </div>
            <div className="text-right">
              <div className="ml-auto flex h-14 w-14 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white/75">
                <AppIcon name="card" className="h-6 w-6" />
              </div>
              <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-white/45">
                Virtual Debit
              </p>
            </div>
          </div>

          <div className="mt-9 sm:mt-12">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white/45">
              Card Number
            </p>
            <h3 className="mt-4 break-all text-[clamp(1rem,5.5vw,1.5rem)] font-black tracking-[0.12em] text-white sm:tracking-[0.16em] lg:text-3xl">
              {display.number}
            </h3>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
            {[
              { label: "Holder", value: display.holder },
              { label: "Expires", value: card.expiry },
              { label: "CVV", value: display.cvv },
            ].map((item) => (
              <div key={item.label} className="min-w-0 rounded-lg border border-white/10 bg-white/10 p-2.5 sm:p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                  {item.label}
                </p>
                <p className="mt-2 truncate text-sm font-black text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${frozen ? "bg-red-400" : "bg-green-400"}`} />
              <p className="text-sm font-bold uppercase tracking-wide text-white/75">
                {frozen ? "Frozen" : "Active"} / {display.lastFour}
              </p>
            </div>
            <p className="text-sm font-semibold text-white/45">
              {cardCapabilities}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={toggleFrozen}
          className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-3 text-[11px] font-black transition-all active:scale-[0.99] sm:flex-row sm:gap-2 sm:py-4 sm:text-sm ${
            frozen ? "bg-red-500 text-white hover:bg-red-400" : "bg-white text-black hover:bg-zinc-100"
          }`}
        >
          <AppIcon name="lock" className="h-4 w-4" />
          {frozen ? "Unfreeze" : "Freeze"}
        </button>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="bank-button flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-3 text-[11px] font-black sm:flex-row sm:gap-2 sm:py-4 sm:text-sm"
        >
          <AppIcon name="shield" className="h-4 w-4" />
          {showDetails ? "Hide" : "Show"}
        </button>
        <Link
          href="/cards"
          className="bank-button flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-3 text-center text-[11px] font-black sm:flex-row sm:gap-2 sm:py-4 sm:text-sm"
        >
          <AppIcon name="card" className="h-4 w-4" />
          Manage
        </Link>
      </div>

      <div className="bank-surface rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Aurex Black Status</p>
            <h3 className="mt-1 text-2xl font-black text-green-400">Protected</h3>
          </div>
          <div className="rounded-lg border border-green-300/15 bg-green-400/10 p-2 text-green-300">
            <AppIcon name="shield" className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bank-panel rounded-lg p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              Daily Spend
            </p>
            <p className="mt-2 text-xl font-black">
              <PrivateAmount
                value={preferences.cardPurchaseLimit}
                maximumFractionDigits={0}
                minimumFractionDigits={0}
              />
            </p>
          </div>
          <div className="bank-panel rounded-lg p-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
              Cashback
            </p>
            <p className="mt-2 text-xl font-black">3.5%</p>
          </div>
        </div>
      </div>
    </section>
  );
}
