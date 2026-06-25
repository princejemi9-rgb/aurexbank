"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";

type TransferRecord = {
  sender: string;
  receiver: string;
  amount: number | string;
};

type InsightTotals = {
  sent: number;
  received: number;
};

export default function FinancialInsights() {
  const { currentProfile } = useBanking();
  const [totals, setTotals] = useState<InsightTotals>({
    sent: 0,
    received: 0,
  });

  useEffect(() => {
    let active = true;
    const username = currentProfile.username;

    async function fetchInsights(): Promise<InsightTotals | null> {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data } = await supabase
        .from("transfers")
        .select("sender, receiver, amount")
        .or(`sender.eq.${username},receiver.eq.${username}`);

      if (!data) return null;

      return (data as TransferRecord[]).reduce(
        (nextTotals, item) => {
          if (item.sender === username) {
            nextTotals.sent += Number(item.amount);
          }

          if (item.receiver === username) {
            nextTotals.received += Number(item.amount);
          }

          return nextTotals;
        },
        {
          sent: 0,
          received: 0,
        }
      );
    }

    async function loadInsights() {
      const nextTotals = await fetchInsights();

      if (active && nextTotals) {
        setTotals(nextTotals);
      }
    }

    loadInsights();

    const channel = supabase
      .channel("financial-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transfers",
        },
        () => {
          loadInsights();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [currentProfile.username]);

  return (
    <div className="bank-surface mt-6 rounded-lg p-5">
      <h2 className="mb-5 text-2xl font-black tracking-tight">
        Financial Insights
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-4">
          <p className="text-sm text-zinc-400">
            Total Sent
          </p>

          <h3 className="mt-2 text-2xl font-black text-red-400">
            <PrivateAmount value={totals.sent} maximumFractionDigits={0} minimumFractionDigits={0} />
          </h3>
        </div>

        <div className="rounded-lg border border-green-400/20 bg-green-500/10 p-4">
          <p className="text-sm text-zinc-400">
            Total Received
          </p>

          <h3 className="mt-2 text-2xl font-black text-green-400">
            <PrivateAmount value={totals.received} maximumFractionDigits={0} minimumFractionDigits={0} />
          </h3>
        </div>
      </div>
    </div>
  );
}
