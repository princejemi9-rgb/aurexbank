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
const amountArg = process.argv[3] || process.env.AMOUNT || '7675896.00';

function parseAmount(value) {
  const num = Number(String(value).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(num)) return null;
  return num;
}

async function run() {
  const amount = parseAmount(amountArg);
  if (amount === null) {
    console.error('Invalid amount:', amountArg);
    process.exit(1);
  }

  console.log('Setting balance for', targetEmail, 'to', amount);

  // find auth user
  let page = 1;
  let found = null;
  while (page <= 10) {
    const res = await client.auth.admin.listUsers({ page, perPage: 100 });
    const users = res.data?.users || [];
    const u = users.find((x) => (x.email || '').toLowerCase() === targetEmail.toLowerCase());
    if (u) { found = u; break; }
    if (!users.length || users.length < 100) break;
    page += 1;
  }

  if (!found) {
    console.error('Auth user not found for', targetEmail);
    process.exit(2);
  }

  const userId = found.id;
  const resolvedUsername = (found.user_metadata && found.user_metadata.username) || found.email || targetEmail;

  // insert admin transfer (cents)
  const cents = Math.round(amount * 100);
  try {
    const encoded = `__AUREX_TX__:${JSON.stringify({ name: 'Admin deposit', status: 'Completed', method: 'Aurex Admin' })}`;
    await client.from('transfers').insert([{ sender: 'Aurex Admin', receiver: resolvedUsername, amount: cents, type: 'Admin deposit', account_type: 'admin:cents', bank_name: encoded }]);
    console.log('Inserted admin transfer for', cents, 'cents');
  } catch (e) {
    console.warn('Warning inserting transfer:', e instanceof Error ? e.message : e);
  }

  // update profiles table (whole dollars)
  try {
    const whole = Math.round(amount);
    const updateRes = await client.from('profiles').update({ balance: whole }).eq('username', resolvedUsername).select('username,balance');
    if (updateRes.error) {
      console.warn('profiles update error:', updateRes.error.message || updateRes.error);
    }

    if (!updateRes.data || updateRes.data.length === 0) {
      const insertRes = await client.from('profiles').insert([{ username: resolvedUsername, balance: whole }]).select('username,balance');
      if (insertRes.error) {
        console.warn('profiles insert error:', insertRes.error.message || insertRes.error);
      } else {
        console.log('Inserted new profiles row:', insertRes.data);
      }
    } else {
      console.log('Updated profiles row:', updateRes.data);
    }
  } catch (e) {
    console.warn('Warning updating profiles:', e instanceof Error ? e.message : e);
  }

  // update auth user metadata and protected metrics
  try {
    const currentApp = found.app_metadata && typeof found.app_metadata === 'object' ? found.app_metadata : {};
    const protectedKey = 'aurex_metrics';
    const savedAt = new Date().toISOString();
    const nextApp = {
      ...currentApp,
      [protectedKey]: {
        balance: Math.round(amount),
        reserve: (found.user_metadata && Number(found.user_metadata.reserve)) || 0,
        income: (found.user_metadata && Number(found.user_metadata.income)) || 0,
        updated_at: savedAt,
      },
    };

    const currentMeta = found.user_metadata && typeof found.user_metadata === 'object' ? found.user_metadata : {};
    const nextMeta = {
      ...currentMeta,
      balance: Math.round(amount),
      admin_updated_at: savedAt,
    };

    const { error } = await client.auth.admin.updateUserById(userId, { user_metadata: nextMeta, app_metadata: nextApp });
    if (error) {
      console.error('Failed to update auth metadata:', error.message || error);
    } else {
      console.log('Auth metadata updated for userId', userId);
    }
  } catch (e) {
    console.warn('Warning updating auth metadata:', e instanceof Error ? e.message : e);
  }

  console.log('Balance set; verify in admin UI.');
}

run().catch((e) => { console.error(e); process.exit(9); });
