"use client";

import Link from "next/link";

import { useBanking } from "../../context/BankingContext";
import { PrivateAmount } from "../ui/PrivateAmount";

export default function CryptoPortfolio() {
  const { reserve } = useBanking();
  const btcValue = reserve * 0.52;
  const ethValue = reserve * 0.48;
  const assets = [
    {
      name: "Bitcoin",
      symbol: "BTC",
      amount: "Reserve allocation",
      value: btcValue,
      growth: "+4.8%",
      allocation: "52%",
      averageCost: "Live reserve",
      icon: "BTC",
      accent: "border-green-300/20 bg-green-400/10 text-green-200",
      fill: "bg-green-300",
      text: "text-green-400",
      trend: [42, 48, 44, 58, 54, 67, 72],
    },
    {
      name: "Ethereum",
      symbol: "ETH",
      amount: "Reserve allocation",
      value: ethValue,
      growth: "-1.2%",
      allocation: "48%",
      averageCost: "Live reserve",
      icon: "ETH",
      accent: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
      fill: "bg-emerald-300",
      text: "text-red-400",
      trend: [64, 60, 62, 55, 58, 52, 49],
    },
  ];

  const metrics = [
    { label: "Yield", value: "5.8%" },
    { label: "Reserve", value: <PrivateAmount value={reserve} maximumFractionDigits={0} minimumFractionDigits={0} /> },
    { label: "Status", value: "Synced" },
  ];

  return (
    <section className="bank-surface relative overflow-hidden rounded-lg p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-200/50 to-transparent" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
              Digital Assets
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight 2xl:text-3xl">
              Crypto Portfolio
            </h2>
          </div>

          <Link
            href="/receive"
            className="bank-button shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            View More
          </Link>
        </div>

        <div className="bank-panel mt-5 overflow-hidden rounded-lg p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-zinc-500">Portfolio Balance</p>
              <h3 className="mt-3 break-words text-4xl font-black tracking-tight 2xl:text-5xl">
                <PrivateAmount value={reserve} maximumFractionDigits={0} minimumFractionDigits={0} />
              </h3>
              <p className="mt-2 text-sm font-semibold text-zinc-500">
                Spot holdings across 2 wallets
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:w-[190px]">
              <div className="rounded-lg border border-green-300/15 bg-green-400/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-green-300/70">
                  24H
                </p>
                <p className="mt-2 text-lg font-black text-green-300">+6.2%</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.045] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                  Risk
                </p>
                <p className="mt-2 text-lg font-black">Med</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-[52%] bg-green-300" />
            <div className="h-full flex-1 bg-emerald-300" />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs font-bold text-zinc-500">
            <span>BTC 52%</span>
            <span>ETH 48%</span>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {assets.map((asset) => (
            <div
              key={asset.symbol}
              className="group rounded-lg border border-white/10 bg-white/[0.025] p-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.055]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-[11px] font-black tracking-wide ${asset.accent}`}
                  >
                    {asset.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-black 2xl:text-xl">
                        {asset.name}
                      </h3>
                      <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-400">
                        {asset.symbol}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {asset.amount} / {asset.averageCost}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-lg font-black 2xl:text-xl">
                    <PrivateAmount value={asset.value} maximumFractionDigits={0} minimumFractionDigits={0} />
                  </p>
                  <p className={`mt-1 text-sm font-bold ${asset.text}`}>
                    {asset.growth}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    Allocation
                  </p>
                  <p className="mt-1 text-sm font-black">{asset.allocation}</p>
                </div>

                <div className="flex h-10 flex-1 items-end justify-end gap-1">
                  {asset.trend.map((height, index) => (
                    <span
                      key={`${asset.symbol}-${index}`}
                      className={`w-1.5 rounded-full ${asset.fill}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {metrics.map((item) => (
            <div key={item.label} className="bank-panel rounded-lg p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                {item.label}
              </p>
              <p className="mt-2 truncate text-sm font-black sm:text-base">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
