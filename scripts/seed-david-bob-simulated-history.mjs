#!/usr/bin/env node
// Creates only clearly marked simulated historical scenarios. It never updates
// profiles, account metrics, transfers, cards, or genuine transaction records.
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)=(.*)$/i);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadLocalEnv();

const apply = process.argv.includes("--apply");
const customerEmail = "davidbob9784@gmail.com";
const adminEmail = (process.env.AUREX_ADMIN_EMAILS || "princejemi9@gmail.com")
  .split(",")[0]
  .trim()
  .toLowerCase();
const scenarios = [
  ["2021-10-14T14:00:00.000Z", "credit", 85000, "Michael Anderson", "Personal transfer", "Private Transfer"],
  ["2022-02-22T11:30:00.000Z", "credit", 125000, "James Mitchell", "Business payment", "Consulting Payment"],
  ["2022-07-08T09:15:00.000Z", "debit", 68000, "Daniel Brooks", "Property expense", "Property Settlement"],
  ["2023-01-19T16:45:00.000Z", "credit", 210000, "Westbridge Holdings LLC", "Investment distribution", "Investment Distribution"],
  ["2023-09-27T12:00:00.000Z", "credit", 96000, "Harrison Property Group", "Property income", "Rental Income"],
  ["2024-04-11T10:20:00.000Z", "debit", 74000, "Catherine Williams", "Personal transfer", "Personal Transfer"],
  ["2024-11-06T15:10:00.000Z", "credit", 325000, "Sterling Capital Partners", "Investment distribution", "Investment Proceeds"],
  ["2025-06-18T13:40:00.000Z", "credit", 115000, "Robert Thompson", "Business payment", "Business Payment"],
  ["2025-12-09T08:50:00.000Z", "debit", 52000, "Alexander Morgan", "Personal transfer", "Private Transfer"],
  ["2026-03-24T17:25:00.000Z", "credit", 175000, "Olivia Bennett", "Personal transfer", "Personal Transfer"],
];

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration.");
  process.exit(1);
}

async function findUser(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) break;
  }
  return null;
}

const customer = await findUser(customerEmail);
const admin = await findUser(adminEmail);
if (!customer || !admin) {
  console.error("Customer or configured administrator was not found.");
  process.exit(2);
}

const records = scenarios.map(([effectiveAt, direction, amount, counterparty, category, description], index) => ({
  customer_id: customer.id,
  direction,
  amount,
  currency: "USD",
  category,
  description,
  counterparty_label: counterparty,
  reference: `SIM-DAVID-${String(index + 1).padStart(2, "0")}-${effectiveAt.slice(0, 10).replaceAll("-", "")}`,
  status: "completed",
  effective_at: effectiveAt,
  created_by: admin.id,
  metadata: { simulated: true, scenario: "david_bob_historical_refresh", seeded_by_script: true },
}));

const { data: existing, error: existingError } = await client
  .from("simulated_historical_transactions")
  .select("reference")
  .eq("customer_id", customer.id)
  .in("reference", records.map((record) => record.reference));
if (existingError) throw existingError;
const existingReferences = new Set((existing ?? []).map((record) => record.reference));
const pending = records.filter((record) => !existingReferences.has(record.reference));

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  customer: customer.email,
  pendingCount: pending.length,
  amounts: pending.map((record) => record.amount),
  references: pending.map((record) => record.reference),
}, null, 2));

if (!apply || !pending.length) process.exit(0);

const { data: inserted, error: insertError } = await client
  .from("simulated_historical_transactions")
  .insert(pending)
  .select("id,reference,counterparty_label,amount,effective_at");
if (insertError) throw insertError;

const { error: auditError } = await client.from("admin_audit_log").insert(
  (inserted ?? []).map((record) => ({
    actor_id: admin.id,
    action: "create_simulated_historical_transaction",
    target_username: customerEmail,
    metadata: { simulated: true, historical_transaction_id: record.id, reference: record.reference, seeded_by_script: true },
  }))
);
if (auditError) {
  // Do not claim the write failed: the records are present and can be audited
  // operationally. The explicit error prevents a silent, incomplete result.
  throw new Error(`Scenarios inserted, but audit logging failed: ${auditError.message}`);
}

console.log(`Inserted and audit-logged ${inserted?.length ?? 0} simulated scenarios. Current balance was not changed.`);
