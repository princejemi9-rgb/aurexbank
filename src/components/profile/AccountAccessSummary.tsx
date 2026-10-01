"use client";

import { useEffect, useState } from "react";
import { useBanking } from "../../context/BankingContext";
import { supabase } from "../../lib/supabase";

export default function AccountAccessSummary() {
  const { currentProfile } = useBanking();
  const [result, setResult] = useState<{ userId: string; signedInAt: string | null; error: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    const userId = currentProfile.userId;
    if (userId === "pending") return;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (active) setResult({ userId, signedInAt: data.user?.id === userId ? data.user.last_sign_in_at ?? null : null, error: Boolean(error) || data.user?.id !== userId });
    }).catch(() => {
      if (active) setResult({ userId, signedInAt: null, error: true });
    });
    return () => { active = false; };
  }, [currentProfile.userId]);

  const current = result?.userId === currentProfile.userId ? result : null;
  const date = current?.signedInAt ? new Date(current.signedInAt) : null;
  const validDate = date && Number.isFinite(date.getTime());
  return <div className="mt-6 space-y-4">
    <dl className="grid gap-4 sm:grid-cols-2">
      <div className="bank-panel min-w-0 rounded-lg p-4"><dt className="text-sm text-zinc-400">Last sign-in</dt><dd className="mt-2 break-words font-semibold">{!current ? "Loading…" : current.error ? "Sign-in details unavailable" : validDate ? <time dateTime={date.toISOString()}>{date.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</time> : "No sign-in recorded"}</dd></div>
      <div className="bank-panel min-w-0 rounded-lg p-4"><dt className="text-sm text-zinc-400">Sign-in location</dt><dd className="mt-2 font-semibold">Location unavailable</dd></div>
    </dl>
    <p className="text-sm leading-relaxed text-zinc-400">Device and location details are not recorded for this sign-in.</p>
  </div>;
}
