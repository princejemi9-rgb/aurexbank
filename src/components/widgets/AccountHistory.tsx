"use client";

import { useState } from "react";
import { useBanking } from "../../context/BankingContext";
import { filterHistory } from "../../lib/transactionHistory";
import { sampleHistory } from "../../fixtures/sampleHistory";
import { BalancePrivacyToggle, PrivateAmount } from "../ui/PrivateAmount";

export default function AccountHistory() {
  const { transactions, historyError, refreshBanking } = useBanking();
  const [sample, setSample] = useState(false);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [year, setYear] = useState("all");
  const [page, setPage] = useState(0);
  const records = sample ? sampleHistory : transactions;
  const filtered = filterHistory(records, query, direction, year);
  const years = [...new Set(records.map(record => record.createdAt?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const lastPage = Math.max(0, Math.ceil(filtered.length / 20) - 1);
  const visiblePage = Math.min(page, lastPage);
  const fieldClass = "min-w-0 rounded-lg border border-white/15 bg-zinc-950 p-3 text-sm text-white";

  return <section className="bank-surface mt-6 min-w-0 rounded-xl p-4 sm:p-6" aria-label="Transaction history">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{sample ? "Sample transaction history" : "Transaction history"}</h2>
      <BalancePrivacyToggle />
    </div>
    <div className="my-4 flex flex-wrap gap-2" aria-label="History source">
      {[false, true].map(value => <button key={String(value)} type="button" aria-pressed={sample === value}
        onClick={() => { setSample(value); setPage(0); setYear("all"); setQuery(""); setDirection("all"); }}
        className={`rounded-lg border px-3 py-2 text-sm font-semibold ${sample === value ? "border-green-300/40 bg-green-400/10 text-green-300" : "border-white/10 text-zinc-400"}`}>
        {value ? "Sample history · simulated" : "Account records"}
      </button>)}
    </div>
    {sample && <p className="mb-4 text-sm leading-relaxed text-zinc-400">Presentation sample only. Illustrative $50 fees on the first of each month, January 2023–September 2026. These entries are not account activity and do not affect your balance. The real billing start date has not been supplied.</p>}
    {!sample && historyError && <div role="alert" className="mb-4 text-sm text-amber-200">{historyError} <button type="button" className="underline" onClick={() => void refreshBanking()}>Retry</button></div>}
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="grid gap-1 text-xs text-zinc-400">Search
        <input className={fieldClass} value={query} placeholder="Description, status or method" onChange={event => { setQuery(event.target.value); setPage(0); }} />
      </label>
      <label className="grid gap-1 text-xs text-zinc-400">Direction
        <select className={fieldClass} value={direction} onChange={event => { setDirection(event.target.value); setPage(0); }}><option value="all">All transactions</option><option value="credit">Credits</option><option value="debit">Debits</option></select>
      </label>
      <label className="grid gap-1 text-xs text-zinc-400">Year
        <select className={fieldClass} value={year} onChange={event => { setYear(event.target.value); setPage(0); }}><option value="all">All years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select>
      </label>
    </div>
    <p className="my-4 text-xs text-zinc-500">{filtered.length} {sample ? "simulated entries" : "account records"} · Newest first · Dates in UTC</p>
    <div className="divide-y divide-white/10">
      {filtered.slice(visiblePage * 20, (visiblePage + 1) * 20).map(record => <article key={record.id} className="grid min-w-0 gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold">{record.name}</h3><span className="rounded border border-white/15 px-2 py-0.5 text-xs text-zinc-400">{record.simulated ? "Simulated" : record.status}</span></div>
          <p className="mt-1 break-words text-xs text-zinc-400"><time dateTime={record.createdAt}>{record.time}</time> · {record.type} · {record.method}</p>
        </div>
        <p className={`whitespace-nowrap text-base font-semibold tabular-nums ${record.amount < 0 ? "text-red-300" : "text-green-300"}`}><PrivateAmount value={Math.abs(record.amount)} prefix={record.amount < 0 ? "-$" : "+$"} /></p>
      </article>)}
      {!filtered.length && <p className="py-8 text-sm text-zinc-400">{historyError && !sample ? "History is currently unavailable." : records.length ? "No transactions match these filters." : "No recorded transactions. Historical records will appear here when available."}</p>}
    </div>
    {lastPage > 0 && <nav className="mt-4 flex items-center justify-between gap-2 text-sm" aria-label="History pages">
      <button className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous</button>
      <span className="text-zinc-400">{visiblePage + 1} / {lastPage + 1}</span>
      <button className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40" disabled={visiblePage === lastPage} onClick={() => setPage(visiblePage + 1)}>Next</button>
    </nav>}
  </section>;
}
