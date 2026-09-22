export type HistoryTransaction = {
  id: string;
  name: string;
  type: string;
  amount: number;
  status: string;
  time: string;
  method: string;
  createdAt?: string;
};

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
  const date = createdAt ? new Date(createdAt) : null;
  return {
    id: String(item.id),
    name: String(details.name || item.description || (sent ? item.receiver : item.sender) || "Transfer"),
    type: String(details.type || item.type || "Transfer"),
    amount: sent ? -Math.abs(amount) : amount,
    status: String(item.status || details.status || "Not recorded"),
    createdAt,
    time: date && Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Date not recorded",
    method: String(details.method || (bank.startsWith("__AUREX_TX__:") ? "" : bank) || "Not recorded"),
  };
}

export function filterHistory(records: HistoryTransaction[], search: string, direction: string, year: string) {
  const query = search.trim().toLowerCase();
  return records.filter(record =>
    (!query || `${record.name} ${record.type} ${record.status} ${record.method}`.toLowerCase().includes(query)) &&
    (direction === "all" || (direction === "credit" ? record.amount > 0 : record.amount < 0)) &&
    (year === "all" || record.createdAt?.slice(0, 4) === year)
  ).sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0));
}
