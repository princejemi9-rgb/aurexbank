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
const dubleyFirstNames = ["Avery", "Caleb", "Elena", "Marcus", "Naomi", "Owen", "Priya", "Russell", "Serena", "Thomas", "Valerie", "Wesley"];
const dubleyLastNames = ["Bennett", "Carter", "Dawson", "Ellis", "Foster"];
const dubleyIncomeAmounts = [35000, 52500, 68500, 78000, 92000, 105000, 118000, 145000, 156000, 187500, 225000, 265000];
const dubleyReserveAmounts = [8500, 17500, 24000, 32500, 45000, 55000, 68000, 75000, 95000, 112500, 125000, 185000, 205000, 250000];
const dubleyPaymentAmounts = [12000, 28000, 50000, 75000, 100000, 150000, 225000];

function dateLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function record(id: string, date: Date, name: string, type: string, category: string, amount: number, reference: string): IllustrativeTransaction {
  return { id, name, type, category, amount, status: "Presentation", method: "Simulated historical scenario", createdAt: date.toISOString(), effectiveAt: date.toISOString(), time: dateLabel(date), illustrative: true, reference };
}

function keyFor(ownerKey: string) { return ownerKey.trim().toLowerCase(); }

function dubleyCounterparty(monthIndex: number, offset: number) {
  const sequence = monthIndex + offset;
  return `${dubleyFirstNames[sequence % dubleyFirstNames.length]} ${dubleyLastNames[Math.floor(sequence / dubleyFirstNames.length) % dubleyLastNames.length]}`;
}

function scheduledAmount(amounts: number[], monthIndex: number, step: number) {
  return amounts[(monthIndex * step + Math.floor(monthIndex / amounts.length)) % amounts.length];
}

const fictionalCounterparties = [
  ["Michael Anderson", "Private Transfer", "Personal transfer"],
  ["James Mitchell", "Consulting Payment", "Business payment"],
  ["Olivia Bennett", "Personal Transfer", "Personal transfer"],
  ["Daniel Brooks", "Property Settlement", "Property expense"],
  ["Westbridge Holdings LLC", "Investment Distribution", "Investment distribution"],
  ["Harrison Property Group", "Rental Income", "Property income"],
  ["Catherine Williams", "Personal Transfer", "Personal transfer"],
  ["Sterling Capital Partners", "Investment Proceeds", "Investment distribution"],
  ["Robert Thompson", "Business Payment", "Business payment"],
  ["Alexander Morgan", "Private Transfer", "Personal transfer"],
] as const;

/** Presentation-only records. They never enter the live ledger or financial calculations. */
export function buildIllustrativeHistory(ownerName: string, ownerKey = ""): IllustrativeTransaction[] {
  const profile = accountPresentations[keyFor(ownerKey)] ?? fallbackPresentation;
  const dubleySchedule = keyFor(ownerKey) === "dudbryan54@gmail.com";
  const experience = getAccountExperience(ownerKey);
  const start = new Date(experience.historyStart);
  const end = new Date(experience.historyEnd);
  const records: IllustrativeTransaction[] = [];
  let cursor = new Date(start);
  let monthIndex = 0;
  while (cursor <= end) {
    const stamp = cursor.toISOString().slice(0, 7);
    const income = dubleySchedule
      ? scheduledAmount(dubleyIncomeAmounts, monthIndex, 5)
      : profile.monthlyIncome + ((monthIndex % 3) - 1) * 350;
    const reserve = dubleySchedule
      ? scheduledAmount(dubleyReserveAmounts, monthIndex, 3)
      : profile.monthlyReserve;
    const service = MONTHLY_FEE;
    const payment = dubleySchedule
      ? scheduledAmount(dubleyPaymentAmounts, monthIndex, 2)
      : profile.monthlyPayment;
    const [incomeName, , incomeCategory] = dubleySchedule ? [dubleyCounterparty(monthIndex, 0), "Income", "Personal transfer"] : fictionalCounterparties[monthIndex % fictionalCounterparties.length];
    const [reserveName, , reserveCategory] = dubleySchedule ? [dubleyCounterparty(monthIndex, 17), "Savings allocation", "Savings"] : fictionalCounterparties[(monthIndex + 3) % fictionalCounterparties.length];
    const [paymentName, , paymentCategory] = dubleySchedule ? [dubleyCounterparty(monthIndex, 43), "Payment", "Property expense"] : fictionalCounterparties[(monthIndex + 6) % fictionalCounterparties.length];
    records.push(record(`illustrative-income-${keyFor(ownerKey)}-${stamp}`, new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 12)), incomeName, "Income", incomeCategory, income, `ILL-INC-${stamp.replace("-", "")}`));
    records.push(record(`illustrative-reserve-${keyFor(ownerKey)}-${stamp}`, new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 18)), reserveName, "Savings allocation", reserveCategory, -reserve, `ILL-SAV-${stamp.replace("-", "")}`));
    records.push(record(`illustrative-fee-${keyFor(ownerKey)}-${stamp}`, cursor, "Aurex Account Service", "Service fee", "Account service charge", -service, `ILL-FEE-${stamp.replace("-", "")}`));
    if (monthIndex % 4 === 2) records.push(record(`illustrative-payment-${keyFor(ownerKey)}-${stamp}`, new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 24)), paymentName, "Payment", paymentCategory, -payment, `ILL-DB-${stamp.replace("-", "")}`));
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
