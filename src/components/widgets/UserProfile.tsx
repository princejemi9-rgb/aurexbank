"use client";

import Image from "next/image";
import { useBanking } from "../../context/BankingContext";

export default function UserProfile() {
  const { currentProfile } = useBanking();
  const { fullName, username } = currentProfile;

  return (
    <div className="bank-surface mb-6 rounded-lg p-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-400 text-2xl font-bold text-black">
          {currentProfile.avatar_url ? <Image src={currentProfile.avatar_url} alt={`${fullName} profile photo`} width={64} height={64} unoptimized className="h-full w-full object-cover object-top" /> : currentProfile.initials}
        </div>

        <div className="min-w-0">
          <p className="text-sm text-zinc-400">
            Account profile
          </p>

          <h2 className="break-words text-xl font-bold sm:text-2xl">
            {fullName}
          </h2>

          <p className="break-all text-sm text-zinc-400">
            @{username}
          </p>
        </div>
      </div>
    </div>
  );
}
