#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  try {
    const file = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/i);
      if (!m) return;
      const key = m[1];
      let val = m[2] || "";
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch {}
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase config in env or .env.local');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const oldUsername = process.argv[2] || process.env.OLD_USERNAME || 'princejemi7@gmail.com';

async function run() {
  console.log('Deleting rows for username:', oldUsername);

  const tables = ['profiles', 'notifications', 'cards', 'transfers'];

  for (const table of tables) {
    try {
      const { data, error } = await client.from(table).delete().eq('username', oldUsername).select('username');
      if (error) {
        console.warn(`Error deleting from ${table}:`, error.message || error);
      } else {
        console.log(`Deleted from ${table}:`, (data || []).length);
      }
    } catch (e) {
      console.warn(`Exception deleting from ${table}:`, e instanceof Error ? e.message : e);
    }
  }

  // Also remove transfers where sender/receiver matches
  try {
    const { data: sdata } = await client.from('transfers').delete().eq('sender', oldUsername).select('id');
    console.log('Deleted transfers sender rows:', (sdata || []).length);
  } catch { }

  try {
    const { data: rdata } = await client.from('transfers').delete().eq('receiver', oldUsername).select('id');
    console.log('Deleted transfers receiver rows:', (rdata || []).length);
  } catch { }

  console.log('Deletion complete.');
}

run().catch((e) => { console.error(e); process.exit(2); });
