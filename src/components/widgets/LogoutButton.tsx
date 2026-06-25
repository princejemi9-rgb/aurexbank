"use client";

import { supabase } from "../../lib/supabase";

export default function LogoutButton() {

  async function logout() {
    // Clear server-set login cookie before signing out.
    try {
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "clear" }),
      });
    } catch {}

    // Fallback for any client-visible cookie state.
    try {
      document.cookie = "sb_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=strict";
    } catch {}

    await supabase.auth.signOut();

    window.location.replace("/login");
  }

  return (
    <button
      onClick={logout}
      className="w-full bg-red-500 hover:bg-red-400 transition text-white font-bold py-4 rounded-2xl mt-6"
    >
      Logout
    </button>
  );
}