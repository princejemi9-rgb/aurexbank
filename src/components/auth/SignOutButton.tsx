"use client";

import { useState } from "react";

import { supabase } from "../../lib/supabase";
import { clearCurrentAccountCache } from "../../lib/sessionLogout";
import AppIcon from "../ui/AppIcon";

type SignOutButtonProps = {
  className?: string;
  label?: string;
};

export default function SignOutButton({
  className = "",
  label = "Sign Out",
}: SignOutButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // This endpoint clears only Aurex's httpOnly login and security-session
      // cookies. It intentionally leaves browser preferences untouched.
      const sessionClear = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ action: "clear" }),
      });
      if (!sessionClear.ok) {
        throw new Error("Unable to clear the Aurex security session.");
      }

      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      clearCurrentAccountCache(session?.user.id);
      window.location.replace("/");
    } catch {
      setError("We could not sign you out. Please check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        aria-busy={busy}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 transition-colors hover:bg-red-500/20 disabled:cursor-wait disabled:opacity-60"
      >
        <AppIcon name="logout" className="h-4 w-4" />
        {busy ? "Signing out…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-200">{error}</p>}
    </div>
  );
}
