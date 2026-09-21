import type { HistoryTransaction } from "../lib/transactionHistory";

// Presentation only: never import into banking context or ledger writers.
// January 2023 is illustrative, not an opening date or agreed billing date.
export const sampleHistory: HistoryTransaction[] = Array.from({ length: 45 }, (_, index) => {
  const date = new Date(Date.UTC(2023, index, 1));
  const createdAt = date.toISOString();
  return {
    id: `sample-maintenance-${createdAt.slice(0, 7)}`,
    name: "Monthly Account Maintenance Fee",
    type: "Maintenance",
    amount: -50,
    status: "Simulated",
    time: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    method: "Sample fixture",
    createdAt,
    simulated: true,
  };
}).reverse();
