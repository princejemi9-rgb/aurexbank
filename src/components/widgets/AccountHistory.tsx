"use client";

import { useMemo, useState } from "react";
import type { BankTransaction } from "../../context/BankingContext";
import { useBanking } from "../../context/BankingContext";
import { buildIllustrativeHistory } from "../../lib/illustrativeHistory";
import { filterHistory } from "../../lib/transactionHistory";
import { BalancePrivacyToggle, PrivateAmount } from "../ui/PrivateAmount";

type TimelineRecord = BankTransaction & { illustrative: boolean; reference?: string };

function TransactionIcon({ amount, generated }: { amount: number; generated: boolean }) {
  const style = generated ? "bg-amber-300/10 text-amber-200" : amount < 0 ? "bg-red-400/10 text-red-200" : "bg-green-400/10 text-green-200";
  const label = generated ? "Generated history record" : amount < 0 ? "Debit" : "Credit";
  return <span aria-label={label} className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${style}`}>{generated ? <>&bull;</> : amount < 0 ? <>&uarr;</> : <>&darr;</>}</span>;
}

export default function AccountHistory() {
  const { currentProfile, transactions, historyError, refreshBanking } = useBanking();
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [year, setYear] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<TimelineRecord | null>(null);
  const generated = useMemo(() => buildIllustrativeHistory(currentProfile.fullName, currentProfile.username), [currentProfile.fullName, currentProfile.username]);
  const records = useMemo<TimelineRecord[]>(() => [...transactions.map(record => ({ ...record, illustrative: false })), ...generated], [transactions, generated]);
  const filtered = filterHistory(records, query, direction, year);
  const years = [...new Set(records.map(record => record.createdAt?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const lastPage = Math.max(0, Math.ceil(filtered.length / 20) - 1);
  const visiblePage = Math.min(page, lastPage);
  const fieldClass = "min-w-0 rounded-lg border border-white/15 bg-zinc-950 px-3 py-2.5 text-sm text-white";

  return <section className="bank-surface mt-6 min-w-0 rounded-xl p-4 sm:p-6" aria-label="Transaction history">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Transaction history</h2><p className="mt-1 text-sm text-zinc-400">All activity, newest first.</p></div><BalancePrivacyToggle /></div>
    <p className="mt-3 text-xs text-zinc-500"><span className="mr-1 inline-block size-1.5 rounded-full bg-amber-300 align-middle" />Generated history is presentation data and never changes live balances.</p>
    {historyError && <div role="alert" className="mt-4 text-sm text-amber-200">{historyError} <button type="button" className="underline" onClick={() => void refreshBanking()}>Retry</button></div>}
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="grid gap-1 text-xs text-zinc-400">Search<input className={fieldClass} value={query} placeholder="Search activity" onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <label className="grid gap-1 text-xs text-zinc-400">Direction<select className={fieldClass} value={direction} onChange={event => { setDirection(event.target.value); setPage(0); }}><option value="all">All activity</option><option value="credit">Credits</option><option value="debit">Debits</option></select></label>
      <label className="grid gap-1 text-xs text-zinc-400">Year<select className={fieldClass} value={year} onChange={event => { setYear(event.target.value); setPage(0); }}><option value="all">All years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    <p className="my-4 text-xs text-zinc-500">{filtered.length} records</p>
    <div className="divide-y divide-white/10">
      {filtered.slice(visiblePage * 20, (visiblePage + 1) * 20).map(record => <button type="button" key={record.id} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-3 text-left transition hover:bg-white/[0.03] sm:gap-3" onClick={() => setSelected(record)}>
        <TransactionIcon amount={record.amount} generated={record.illustrative} />
        <div className="min-w-0"><h3 className="truncate text-sm font-semibold">{record.name}</h3><p className="mt-0.5 truncate text-xs text-zinc-400"><time dateTime={record.createdAt}>{record.time}</time> &middot; {record.type}</p></div>
        <p className={`whitespace-nowrap text-right text-sm font-semibold tabular-nums ${record.amount < 0 ? "text-red-300" : "text-green-300"}`}><PrivateAmount value={Math.abs(record.amount)} prefix={record.amount < 0 ? "-$" : "+$"} /></p>
      </button>)}
      {!filtered.length && <p className="py-8 text-sm text-zinc-400">{historyError ? "History is currently unavailable." : "No transactions match these filters."}</p>}
    </div>
    {lastPage > 0 && <nav className="mt-4 flex items-center justify-between gap-2 text-sm" aria-label="History pages"><button className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous</button><span className="text-zinc-400">{visiblePage + 1} / {lastPage + 1}</span><button className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40" disabled={visiblePage === lastPage} onClick={() => setPage(visiblePage + 1)}>Next</button></nav>}
    {selected && <aside className={`mt-5 rounded-lg border p-4 ${selected.illustrative ? "border-amber-300/30 bg-amber-300/[0.06]" : "border-green-300/25 bg-green-400/[0.06]"}`} aria-label="Transaction details"><div className="flex items-start justify-between gap-3"><div><p className={`text-xs font-bold uppercase tracking-widest ${selected.illustrative ? "text-amber-200" : "text-green-200"}`}>{selected.illustrative ? "Generated history record" : "Transaction details"}</p><h3 className="mt-1 font-bold">{selected.name}</h3></div><button type="button" className="text-sm text-zinc-300 underline" onClick={() => setSelected(null)}>Close</button></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-zinc-400">Date</dt><dd>{selected.time}</dd></div><div><dt className="text-zinc-400">Reference</dt><dd>{selected.reference || "Not assigned"}</dd></div><div><dt className="text-zinc-400">Method</dt><dd>{selected.method}</dd></div><div><dt className="text-zinc-400">Amount</dt><dd className={selected.amount < 0 ? "text-red-300" : "text-green-300"}><PrivateAmount value={Math.abs(selected.amount)} prefix={selected.amount < 0 ? "-$" : "+$"} /></dd></div></dl>{selected.illustrative && <p className="mt-4 text-xs text-amber-100/75">Presentation data only; it is not a posted transaction.</p>}</aside>}
  </section>;
}
