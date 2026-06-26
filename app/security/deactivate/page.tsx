"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import DesktopSidebar from "../../../src/components/layout/DesktopSidebar";
import BottomNav from "../../../src/components/navigation/BottomNav";
import AppIcon from "../../../src/components/ui/AppIcon";
import { supabase } from "../../../src/lib/supabase";

export default function DeactivatePage() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function deactivateProfile() {
    setError("");

    if (confirmText !== "DEACTIVATE") {
      setError("Please type DEACTIVATE to continue.");
      return;
    }

    setLoading(true);
    await supabase.auth.signOut();
    localStorage.clear();

    window.setTimeout(() => {
      router.push("/login");
    }, 1000);
  }

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-[16.25rem]">
        <div className="app-inner">
          <section className="rounded-lg border border-red-500/15 bg-red-500/5 p-6 lg:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
              Restricted Banking Action
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Deactivate Banking Profile
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Deactivating your Aurex Bank profile will terminate active sessions and disable account access across linked devices.
            </p>
          </section>

          <section className="bank-surface mt-6 rounded-lg p-6">
            <div className="rounded-lg border border-red-500/15 bg-red-500/5 p-5">
              <h2 className="text-2xl font-black text-red-400">Important Information</h2>
              <div className="mt-5 space-y-3">
                {[
                  "Active banking sessions will be terminated.",
                  "Aurex Bank dashboard access will be disabled.",
                  "Linked device authentication will be removed.",
                  "Banking preferences will reset locally.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-400/15 text-red-200">
                      <AppIcon name="check" className="h-3 w-3" />
                    </span>
                    <p className="text-sm leading-relaxed text-zinc-400">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-medium text-zinc-400">
                Type DEACTIVATE to continue
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder="DEACTIVATE"
                className="mt-3 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all placeholder:text-zinc-600 focus:border-red-400"
              />
            </label>

            {error && (
              <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={deactivateProfile}
                disabled={loading}
                className="rounded-lg bg-red-500 px-6 py-4 text-sm font-black text-white transition-all hover:bg-red-400 disabled:opacity-50"
              >
                {loading ? "Deactivating..." : "Deactivate Profile"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="bank-button rounded-lg px-6 py-4 text-sm font-black"
              >
                Cancel
              </button>
            </div>
          </section>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
