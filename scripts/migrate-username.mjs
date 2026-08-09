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

const oldUsername = process.argv[2] || process.env.OLD_USERNAME;
const newUsername = process.argv[3] || process.env.NEW_USERNAME;

if (!oldUsername || !newUsername) {
  console.error('Usage: node scripts/migrate-username.mjs <oldUsername> <newUsername>');
  process.exit(1);
}

async function run() {
  console.log('Renaming', oldUsername, '=>', newUsername);

  // Profiles
  try {
    const { data: existing } = await client.from('profiles').select('username').eq('username', newUsername).limit(1).maybeSingle();
    if (existing) {
      console.log('Profile with new username already exists; skipping profile update.');
    } else {
      const { error } = await client.from('profiles').update({ username: newUsername }).eq('username', oldUsername).throwOnError();
      if (error) console.warn('profiles update error:', error.message || error);
      else console.log('profiles updated');
    }
  } catch (e) { console.warn('profiles error', e); }

  // Notifications
  try {
    const { data, error } = await client.from('notifications').update({ username: newUsername }).eq('username', oldUsername).select('username');
    if (error) console.warn('notifications update error:', error.message || error);
    else console.log('notifications updated rows:', (data || []).length);
  } catch (e) { console.warn('notifications error', e); }

  // Cards
  try {
    const { data, error } = await client.from('cards').update({ username: newUsername }).eq('username', oldUsername).select('id');
    if (error) console.warn('cards update error:', error.message || error);
    else console.log('cards updated rows:', (data || []).length);
  } catch (e) { console.warn('cards error', e); }

  // Transfers: sender and receiver
  try {
    const { data: sdata, error: sErr } = await client.from('transfers').update({ sender: newUsername }).eq('sender', oldUsername).select('id');
    if (sErr) console.warn('transfers sender update error:', sErr.message || sErr);
    else console.log('transfers sender updated rows:', (sdata || []).length);
    const { data: rdata, error: rErr } = await client.from('transfers').update({ receiver: newUsername }).eq('receiver', oldUsername).select('id');
    if (rErr) console.warn('transfers receiver update error:', rErr.message || rErr);
    else console.log('transfers receiver updated rows:', (rdata || []).length);
  } catch (e) { console.warn('transfers error', e); }

  console.log('Migration complete. Verify in admin UI.');
}

run().catch((e) => { console.error(e); process.exit(2); });
