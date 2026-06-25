"use client";

import AppIcon from "../ui/AppIcon";
import { useBanking } from "../../context/BankingContext";

export default function CardStack() {
  const { currentProfile } = useBanking();

  return (
    <div className="relative mb-6 h-72">
      <div className="absolute inset-x-0 top-10 h-56 translate-x-6 rotate-6 rounded-lg border border-white/10 bg-zinc-800 opacity-60" />
      <div className="absolute inset-x-0 top-5 h-56 translate-x-3 rotate-3 rounded-lg border border-white/10 bg-zinc-700 opacity-80" />

      <div className="absolute inset-x-0 top-0 h-56 rounded-lg bg-gradient-to-br from-green-400 via-green-500 to-emerald-700 p-6 text-black shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-black/55">
              Aurex Black Card
            </p>

            <h3 className="mt-8 text-2xl font-black tracking-[0.28em]">
              **** 4582
            </h3>
          </div>

          <div className="rounded-lg border border-black/10 bg-black/10 p-2">
            <AppIcon name="card" className="h-5 w-5" />
          </div>
        </div>

        <div className="absolute bottom-6 left-6 right-6 flex justify-between gap-4 text-sm">
          <div>
            <p className="text-black/55">Card Holder</p>
            <h4 className="mt-1 font-black">{currentProfile.fullName}</h4>
          </div>

          <div className="text-right">
            <p className="text-black/55">Expires</p>
            <h4 className="mt-1 font-black">09/30</h4>
          </div>
        </div>
      </div>
    </div>
  );
}
