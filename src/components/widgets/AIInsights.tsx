"use client";

import { PrivateMoneyText } from "../ui/PrivateAmount";

export default function AIInsights() {
  const insights = [
    {
      title: "Spending improved this week",
      desc: "Entertainment expenses reduced by 18% compared to last week.",
      code: "01",
    },
    {
      title: "Savings goal almost reached",
      desc: "You are 72% closer to your Dubai Vacation target.",
      code: "02",
    },
    {
      title: "Crypto market alert",
      desc: "Bitcoin moved above $68K in the last 24 hours.",
      code: "03",
    },
  ];

  return (
    <section className="rounded-lg border border-green-300/15 bg-gradient-to-br from-green-400/[0.09] to-white/[0.025] p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-green-400">Aurex Intelligence</p>
          <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight">
            Smart Financial Insights
          </h2>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-green-300/15 bg-green-400/10 text-sm font-black text-green-300">
          AI
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {insights.map((insight) => (
          <div key={insight.title} className="rounded-lg border border-white/10 bg-black/25 p-4">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.055] text-xs font-black text-zinc-500">
                {insight.code}
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-black leading-tight">{insight.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  <PrivateMoneyText text={insight.desc} />
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
        <p className="text-sm text-zinc-500">AI-powered banking intelligence</p>
        <button className="rounded-lg bg-green-400 px-4 py-2.5 text-sm font-black text-black transition-all hover:bg-green-300">
          View
        </button>
      </div>
    </section>
  );
}
