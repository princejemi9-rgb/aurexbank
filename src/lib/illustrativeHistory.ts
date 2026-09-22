import type { BankTransaction } from "../context/BankingContext";

export type IllustrativeTransaction = BankTransaction & {
  illustrative: true;
  reference: string;
};

const MONTHLY_FEE = 50;
const start = new Date(Date.UTC(2022, 0, 1));
const end = new Date(Date.UTC(2026, 8, 1));

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function record(
  id: string,
  date: Date,
  name: string,
  type: string,
  amount: number,
  reference: string
): IllustrativeTransaction {
  return {
    id,
    name,
    type,
    amount,
    status: "Illustrative",
    method: "Illustrative presentation record",
    createdAt: date.toISOString(),
    time: formatDate(date),
    illustrative: true,
    reference,
  };
}

/** Presentation-only records. They never enter the live ledger or financial calculations. */
export function buildIllustrativeHistory(ownerName: string): IllustrativeTransaction[] {
  const records: IllustrativeTransaction[] = [];
  let feeDate = new Date(start);

  while (feeDate <= end) {
    const stamp = feeDate.toISOString().slice(0, 7);
    records.push(
      record(
        `illustrative-fee-${stamp}`,
        feeDate,
        "Illustrative Monthly Account Maintenance Fee",
        "Illustrative service fee",
        -MONTHLY_FEE,
        `ILL-FEE-${stamp.replace("-", "")}`
      )
    );
    feeDate = new Date(Date.UTC(feeDate.getUTCFullYear(), feeDate.getUTCMonth() + 1, 1));
  }

  for (let year = 2022; year <= 2026; year += 1) {
    const creditMonth = year === 2026 ? 6 : 5;
    const debitMonth = year === 2026 ? 7 : 10;
    records.push(
      record(
        `illustrative-credit-${year}`,
        new Date(Date.UTC(year, creditMonth, 15)),
        `Illustrative credit for ${ownerName}`,
        "Illustrative credit",
        125000 + (year - 2022) * 25000,
        `ILL-CR-${year}`
      )
    );
    records.push(
      record(
        `illustrative-debit-${year}`,
        new Date(Date.UTC(year, debitMonth, 20)),
        "Illustrative scheduled payment",
        "Illustrative debit",
        -(8750 + (year - 2022) * 1250),
        `ILL-DB-${year}`
      )
    );
  }

  return records.sort((left, right) =>
    (right.createdAt || "").localeCompare(left.createdAt || "")
  );
}

export const illustrativeHistoryPeriod = "January 2022 through September 2026";
