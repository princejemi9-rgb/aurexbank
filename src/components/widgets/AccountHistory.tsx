"use client";

import { useMemo, useState } from "react";
import type { BankTransaction } from "../../context/BankingContext";
import { useBanking } from "../../context/BankingContext";
import { buildIllustrativeHistory, illustrativeHistoryPeriod, type IllustrativeTransaction } from "../../lib/illustrativeHistory";
import { filterHistory } from "../../lib/transactionHistory";
import { BalancePrivacyToggle, PrivateAmount } from "../ui/PrivateAmount";

type TimelineRecord = BankTransaction & Partial<IllustrativeTransaction>;

export default function AccountHistory() {
  const { currentProfile, transactions, historyError, refreshBanking } = useBanking();
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [year, setYear] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<TimelineRecord | null>(null);
  const illustrative = useMemo(() => buildIllustrativeHistory(currentProfile.fullName, currentProfile.username), [currentProfile.fullName, currentProfile.username]);
  const records = useMemo(() => [...transactions, ...illustrative], [transactions, illustrative]);
  const filtered = filterHistory(records, query, direction, year);
  const years = [...new Set(records.map(record => record.createdAt?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const lastPage = Math.max(0, Math.ceil(filtered.length / 20) - 1);
  const visiblePage = Math.min(page, lastPage);
  const fieldClass = "min-w-0 rounded-lg border border-white/15 bg-zinc-950 p-3 text-sm text-white";

  return <section className="bank-surface mt-6 min-w-0 rounded-xl p-4 sm:p-6" aria-label="Transaction history">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Transaction history</h2><BalancePrivacyToggle /></div>
    <p className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3 text-xs text-amber-100">Recorded and illustrative records are shown together, newest first. Illustrative records cover {illustrativeHistoryPeriod} and never affect live balances or transfers.</p>
    {historyError && <div role="alert" className="mt-4 text-sm text-amber-200">{historyError} <button type="button" className="underline" onClick={() => void refreshBanking()}>Retry</button></div>}
    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="grid gap-1 text-xs text-zinc-400">Search<input className={fieldClass} value={query} placeholder="Description, status or method" onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <label className="grid gap-1 text-xs text-zinc-400">Direction<select className={fieldClass} value={direction} onChange={event => { setDirection(event.target.value); setPage(0); }}><option value="all">All transactions</option><option value="credit">Credits</option><option value="debit">Debits</option></select></label>
      <label className="grid gap-1 text-xs text-zinc-400">Year<select className={fieldClass} value={year} onChange={event => { setYear(event.target.value); setPage(0); }}><option value="all">All years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    <p className="my-4 text-xs text-zinc-500">{filtered.length} records · Newest first · Dates in UTC</p>
    <div className="divide-y divide-white/10">
      {filtered.slice(visiblePage * 20, (visiblePage + 1) * 20).map(record => <button type="button" key={record.id} className="grid w-full min-w-0 gap-2 py-4 text-left transition hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" onClick={() => setSelected(record)}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-semibold">{record.name}</h3><span className="rounded border border-white/15 px-2 py-0.5 text-xs text-zinc-400">{record.status}</span>{record.illustrative && <span className="rounded border border-amber-300/30 px-2 py-0.5 text-xs text-amber-200">Illustrative</span>}</div><p className="mt-1 break-words text-xs text-zinc-400"><time dateTime={record.createdAt}>{record.time}</time> · {record.type} · {record.method}</p></div>
        <p className={`whitespace-nowrap text-base font-semibold tabular-nums ${record.amount < 0 ? "text-red-300" : "text-green-300"}`}><PrivateAmount value={Math.abs(record.amount)} prefix={record.amount < 0 ? "-$" : "+$"} /></p>
      </button>)}
      {!filtered.length && <p className="py-8 text-sm text-zinc-400">{historyError ? "History is currently unavailable." : "No transactions match these filters."}</p>}
    </div>
    {lastPage > 0 && <nav className="mt-4 flex items-center justify-between gap-2 text-sm" aria-label="History pages"><button className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous</button><span className="text-zinc-400">{visiblePage + 1} / {lastPage + 1}</span><button className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40" disabled={visiblePage === lastPage} onClick={() => setPage(visiblePage + 1)}>Next</button></nav>}
    {selected && <aside className={`mt-5 rounded-lg border p-4 ${selected.illustrative ? "border-amber-300/30 bg-amber-300/[0.07]" : "border-green-300/25 bg-green-400/[0.06]"}`} aria-label="Transaction details"><div className="flex items-start justify-between gap-3"><div><p className={`text-xs font-bold uppercase tracking-widest ${selected.illustrative ? "text-amber-200" : "text-green-200"}`}>{selected.illustrative ? "Illustrative transaction details" : "Recorded transaction details"}</p><h3 className="mt-1 font-bold">{selected.name}</h3></div><button type="button" className="text-sm text-zinc-300 underline" onClick={() => setSelected(null)}>Close</button></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-zinc-400">Date</dt><dd>{selected.time}</dd></div><div><dt className="text-zinc-400">Reference</dt><dd>{selected.reference || "Not assigned"}</dd></div><div><dt className="text-zinc-400">Classification</dt><dd>{selected.type}</dd></div><div><dt className="text-zinc-400">Amount</dt><dd className={selected.amount < 0 ? "text-red-300" : "text-green-300"}><PrivateAmount value={Math.abs(selected.amount)} prefix={selected.amount < 0 ? "-$" : "+$"} /></dd></div></dl>{selected.illustrative && <p className="mt-4 text-xs text-amber-100/75">This is an illustrative presentation record and is not a posted financial transaction.</p>}</aside>}
  </section>;
}
