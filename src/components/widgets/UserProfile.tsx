"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (active) {
        setUser(user);
      }
    }

    getUser();

    return () => {
      active = false;
    };
  }, []);

  const fullName = String(user?.user_metadata?.full_name ?? "Aurex User");
  const username = String(user?.user_metadata?.username ?? "aurexbank");

  return (
    <div className="bank-surface mb-6 rounded-lg p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-green-400 text-2xl font-black text-black">
          {fullName.charAt(0)}
        </div>

        <div>
          <p className="text-sm text-zinc-400">
            Logged In Account
          </p>

          <h2 className="text-2xl font-black">
            {fullName}
          </h2>

          <p className="text-sm text-zinc-500">
            @{username}
          </p>
        </div>
      </div>
    </div>
  );
}
