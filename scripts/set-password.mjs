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

const targetEmail = process.argv[2] || process.env.TARGET_EMAIL || 'donaldlwie441@gmail.com';
const newPassword = process.argv[3] || process.env.NEW_PASSWORD || process.env.PASSWORD || '';

if (!newPassword) {
  console.error('Usage: node scripts/set-password.mjs <email> <newPassword> OR set NEW_PASSWORD env');
  process.exit(1);
}

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 10) {
    const res = await client.auth.admin.listUsers({ page, perPage: 100 });
    const users = res.data?.users || [];
    const found = users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!users.length || users.length < 100) break;
    page += 1;
  }
  return null;
}

async function run() {
  console.log('Locating user for', targetEmail);
  const user = await findUserByEmail(targetEmail);
  if (!user) {
    console.error('User not found:', targetEmail);
    process.exit(2);
  }

  try {
    const { error } = await client.auth.admin.updateUserById(user.id, { password: newPassword });
    if (error) {
      console.error('Failed to update password:', error.message || error);
      process.exit(3);
    }
    console.log('Password updated for user id:', user.id);
  } catch (e) {
    console.error('Exception updating password:', e instanceof Error ? e.message : e);
    process.exit(4);
  }
}

run().catch((e) => { console.error(e); process.exit(9); });
