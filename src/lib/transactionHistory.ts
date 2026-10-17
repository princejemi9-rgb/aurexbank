export type HistoryTransaction = {
  id: string;
  name: string;
  type: string;
  amount: number;
  status: string;
  time: string;
  method: string;
  reference?: string;
  createdAt?: string;
  effectiveAt?: string;
  category?: string;
};

function formatEffectiveDate(value: string | undefined) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Date not recorded";
}

export function mapHistoryRecord(item: Record<string, unknown>, username: string): HistoryTransaction {
  let details: Record<string, unknown> = {};
  const bank = String(item.bank_name || "");
  if (bank.startsWith("__AUREX_TX__:")) {
    try { details = JSON.parse(bank.slice("__AUREX_TX__:".length)) || {}; } catch { /* Keep malformed legacy records visible. */ }
  }
  const rawAmount = Number(item.amount);
  const amount = String(item.account_type || "").endsWith(":cents") ? rawAmount / 100 : rawAmount;
  const sent = item.sender === username;
  const createdAt = typeof item.created_at === "string" ? item.created_at : undefined;
  const effectiveAt = typeof details.effectiveAt === "string" ? details.effectiveAt : createdAt;
  return {
    id: String(item.id),
    name: String(details.name || item.description || (sent ? item.receiver : item.sender) || "Transfer"),
    type: String(details.type || item.type || "Transfer"),
    amount: sent ? -Math.abs(amount) : amount,
    status: String(item.status || details.status || "Not recorded"),
    createdAt,
    effectiveAt,
    time: formatEffectiveDate(effectiveAt),
    method: String(details.method || (bank.startsWith("__AUREX_TX__:") ? "" : bank) || "Not recorded"),
    reference: typeof details.reference === "string" ? details.reference : undefined,
    category: typeof details.category === "string" ? details.category : undefined,
  };
}

/** Maps only records from the RLS-protected simulated-history table. */
export function mapSimulatedHistoryRecord(item: Record<string, unknown>): HistoryTransaction {
  const direction = String(item.direction || "credit");
  const amount = Math.abs(Number(item.amount) || 0) * (direction === "debit" ? -1 : 1);
  const effectiveAt = typeof item.effective_at === "string" ? item.effective_at : undefined;
  return {
    id: `simulated-history-${String(item.id)}`,
    name: String(item.counterparty_label || item.description || "Simulated counterparty"),
    type: String(item.category || "Historical scenario"),
    category: String(item.category || "Historical scenario"),
    amount,
    status: String(item.status || "completed"),
    createdAt: typeof item.created_at === "string" ? item.created_at : undefined,
    effectiveAt,
    time: formatEffectiveDate(effectiveAt),
    method: "Simulated historical scenario",
    reference: typeof item.reference === "string" ? item.reference : undefined,
  };
}

export function filterHistory<T extends HistoryTransaction>(records: T[], search: string, direction: string, year: string, category = "all", transactionType = "all"): T[] {
  const query = search.trim().toLowerCase();
  return records.filter(record =>
    (!query || `${record.name} ${record.type} ${record.category || ""} ${record.status} ${record.method}`.toLowerCase().includes(query)) &&
    (direction === "all" || (direction === "credit" ? record.amount > 0 : record.amount < 0)) &&
    (year === "all" || (record.effectiveAt || record.createdAt)?.slice(0, 4) === year) &&
    (category === "all" || record.category === category) &&
    (transactionType === "all" || record.type === transactionType)
  ).sort((a, b) => (Date.parse(b.effectiveAt || b.createdAt || "") || 0) - (Date.parse(a.effectiveAt || a.createdAt || "") || 0));
}
