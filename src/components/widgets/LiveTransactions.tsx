"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type TransactionRecord = {
  id: string | number;
  title: string;
  status: string;
  amount: string | number;
};

export default function LiveTransactions() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  useEffect(() => {
    let active = true;

    async function fetchTransactions() {
      const { data } = await supabase
        .from("transactions")
        .select("id, title, status, amount");

      if (active && data) {
        setTransactions(data as TransactionRecord[]);
      }
    }

    fetchTransactions();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bank-surface mt-6 rounded-lg p-5">
      <h2 className="mb-5 text-2xl font-black tracking-tight">
        Live Transactions
      </h2>

      <div className="space-y-4">
        {transactions.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between"
          >
            <div>
              <h3 className="font-semibold">
                {item.title}
              </h3>

              <p className="text-sm text-zinc-500">
                {item.status}
              </p>
            </div>

            <p className="font-bold">
              {item.amount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
