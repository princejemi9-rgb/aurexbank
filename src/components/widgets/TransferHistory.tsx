"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { accountTransferFilter } from "../../lib/supabaseFilters";
import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";

type TransferRecord = {
  id: string | number;
  sender: string;
  receiver: string;
  amount: number | string;
};

export default function TransferHistory() {
  const { currentProfile } = useBanking();
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [search, setSearch] = useState("");
  const [currentUser, setCurrentUser] = useState("");

  useEffect(() => {
    let active = true;
    const username = currentProfile.username;

    async function fetchTransfers(): Promise<{
      username: string;
      transfers: TransferRecord[];
    } | null> {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const { data } = await supabase
        .from("transfers")
        .select("id, sender, receiver, amount")
        .or(accountTransferFilter(username))
        .order("created_at", {
          ascending: false,
        });

      return {
        username,
        transfers: (data as TransferRecord[] | null) ?? [],
      };
    }

    async function loadTransfers() {
      const next = await fetchTransfers();

      if (active && next) {
        setCurrentUser(next.username);
        setTransfers(next.transfers);
      }
    }

    loadTransfers();

    const channel = supabase
      .channel("transfer-history")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transfers",
        },
        () => {
          loadTransfers();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [currentProfile.username]);

  const filteredTransfers = useMemo(() => {
    const term = search.toLowerCase();

    return transfers.filter(
      (item) =>
        item.sender.toLowerCase().includes(term) ||
        item.receiver.toLowerCase().includes(term)
    );
  }, [search, transfers]);

  return (
    <div className="bank-surface mt-6 rounded-lg p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight">
          Transfer History
        </h2>

        <p className="text-sm font-bold text-green-400">
          Secure
        </p>
      </div>

      <input
        type="text"
        placeholder="Search transfers..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-5 w-full rounded-lg border border-white/10 bg-black/30 p-4 outline-none transition-all placeholder:text-zinc-600 focus:border-green-400/40"
      />

      <div className="space-y-4">
        {filteredTransfers.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between border-b border-white/10 pb-3"
          >
            <div>
              <h3 className="font-semibold">
                {item.sender}
              </h3>

              <p className="text-sm text-zinc-500">
                {item.sender === item.receiver
                  ? "Internal Transfer"
                  : item.sender === currentUser
                    ? `Sent to ${item.receiver}`
                    : `Received from ${item.sender}`}
              </p>
            </div>

            <p
              className={`font-black ${
                item.sender === currentUser
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              <PrivateAmount
                value={Number(item.amount)}
                prefix={item.sender === currentUser ? "-$" : "+$"}
                maximumFractionDigits={0}
                minimumFractionDigits={0}
              />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
