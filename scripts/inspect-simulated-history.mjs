#!/usr/bin/env node
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

const targetEmail = (process.argv[2] || "").trim().toLowerCase();
const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

if (!targetEmail || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Usage: node scripts/inspect-simulated-history.mjs customer@example.com");
  process.exit(1);
}

async function findUser() {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === targetEmail);
    if (user) return user;
    if (data.users.length < 100) break;
  }
  return null;
}

const user = await findUser();
if (!user) {
  console.error("Customer was not found.");
  process.exit(2);
}

const [historical, legacy] = await Promise.all([
  client
    .from("simulated_historical_transactions")
    .select("id,direction,amount,currency,category,description,counterparty_label,reference,status,effective_at,created_at,metadata")
    .eq("customer_id", user.id)
    .order("effective_at", { ascending: false }),
  client
    .from("transfers")
    .select("id,sender,receiver,amount,account_type,bank_name,created_at")
    .or(`sender.eq.${targetEmail},receiver.eq.${targetEmail}`)
    .order("created_at", { ascending: false })
    .limit(100),
]);

if (historical.error) console.error("Historical table error:", historical.error.message);
if (legacy.error) console.error("Legacy transfers error:", legacy.error.message);

console.log(JSON.stringify({
  customerId: user.id,
  customerEmail: user.email,
  simulatedHistoricalRecords: historical.data ?? [],
  relatedLegacyTransfers: (legacy.data ?? []).map((record) => ({
    ...record,
    bank_name: String(record.bank_name || "").slice(0, 240),
  })),
}, null, 2));
