import type { BankTransaction } from "../context/BankingContext";
import { getAccountExperience } from "./accountExperience";

export type IllustrativeTransaction = BankTransaction & { illustrative: true; reference: string };

type AccountPresentation = { monthlyIncome: number; monthlyReserve: number; monthlyPayment: number };

const accountPresentations: Record<string, AccountPresentation> = {
  "dudbryan54@gmail.com": { monthlyIncome: 10300, monthlyReserve: 2350, monthlyPayment: 1675 },
  "francovercelli647@gmail.com": { monthlyIncome: 18500, monthlyReserve: 5600, monthlyPayment: 3250 },
  "leonardodante731@gmail.com": { monthlyIncome: 14200, monthlyReserve: 4200, monthlyPayment: 2180 },
  "antonioserg79@gmail.com": { monthlyIncome: 16800, monthlyReserve: 4800, monthlyPayment: 2760 },
  "donaldlwie441@gmail.com": { monthlyIncome: 11200, monthlyReserve: 3400, monthlyPayment: 1840 },
  "princejemi9@gmail.com": { monthlyIncome: 22000, monthlyReserve: 6500, monthlyPayment: 4100 },
};
const fallbackPresentation: AccountPresentation = { monthlyIncome: 9500, monthlyReserve: 2800, monthlyPayment: 1500 };
const MONTHLY_FEE = 50;

function dateLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function record(id: string, date: Date, name: string, type: string, amount: number, reference: string): IllustrativeTransaction {
  return { id, name, type, amount, status: "Presentation", method: "Generated history", createdAt: date.toISOString(), time: dateLabel(date), illustrative: true, reference };
}

function keyFor(ownerKey: string) { return ownerKey.trim().toLowerCase(); }

/** Presentation-only records. They never enter the live ledger or financial calculations. */
export function buildIllustrativeHistory(ownerName: string, ownerKey = ""): IllustrativeTransaction[] {
  const profile = accountPresentations[keyFor(ownerKey)] ?? fallbackPresentation;
  const experience = getAccountExperience(ownerKey);
  const start = new Date(experience.historyStart);
  const end = new Date(experience.historyEnd);
  const records: IllustrativeTransaction[] = [];
  let cursor = new Date(start);
  let monthIndex = 0;
  while (cursor <= end) {
    const stamp = cursor.toISOString().slice(0, 7);
    const income = profile.monthlyIncome + ((monthIndex % 3) - 1) * 350;
    records.push(record(`illustrative-income-${keyFor(ownerKey)}-${stamp}`, new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 12)), "Northstar Consulting Payroll", "Income", income, `ILL-INC-${stamp.replace("-", "")}`));
    records.push(record(`illustrative-reserve-${keyFor(ownerKey)}-${stamp}`, new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 18)), "Aurex Reserve Transfer", "Savings allocation", -profile.monthlyReserve, `ILL-SAV-${stamp.replace("-", "")}`));
    records.push(record(`illustrative-fee-${keyFor(ownerKey)}-${stamp}`, cursor, "Aurex Account Service", "Service fee", -MONTHLY_FEE, `ILL-FEE-${stamp.replace("-", "")}`));
    if (monthIndex % 4 === 2) records.push(record(`illustrative-payment-${keyFor(ownerKey)}-${stamp}`, new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 24)), "Greenwood Property Management", "Payment", -profile.monthlyPayment, `ILL-DB-${stamp.replace("-", "")}`));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    monthIndex += 1;
  }
  return records.filter(record => record.createdAt! <= experience.historyEnd)
    .sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || ""));
}

export function getIllustrativePresentation(ownerName: string, ownerKey = "") {
  const records = buildIllustrativeHistory(ownerName, ownerKey);
  const latestMonth = getAccountExperience(ownerKey).historyEnd.slice(0, 7);
  const income = records.filter(record => record.type === "Income" && record.createdAt?.startsWith(latestMonth)).reduce((sum, record) => sum + record.amount, 0);
  const reserve = records.filter(record => record.type === "Savings allocation").reduce((sum, record) => sum + Math.abs(record.amount), 0);
  return { records, income, reserve };
}

export const illustrativeHistoryPeriod = "January 2022 through September 2026";

/** Select display metrics without mixing generated records into stored account values. */
export function getAccountOverviewMetrics(ownerName: string, ownerKey: string, stored: { income: number; reserve: number }, email = ownerKey) {
  if (getAccountExperience(email).storedMetrics) return { ...stored, illustrative: false };
  const { income, reserve } = getIllustrativePresentation(ownerName, ownerKey);
  return { income, reserve, illustrative: true };
}
