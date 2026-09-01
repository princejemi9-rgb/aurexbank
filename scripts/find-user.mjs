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

const target = process.env.TARGET_EMAIL || process.argv[2] || 'prince';

async function run() {
  console.log('Searching auth users for:', target);
  let page = 1;
  const foundUsers = [];
  while (page <= 10) {
    const res = await client.auth.admin.listUsers({ page, perPage: 100 });
    const users = res.data?.users || [];
    users.forEach((u) => {
      if ((u.email || '').toLowerCase().includes(target.toLowerCase()) || ((u.user_metadata && JSON.stringify(u.user_metadata)) || '').toLowerCase().includes(target.toLowerCase())) {
        foundUsers.push({ id: u.id, email: u.email, metadata: u.user_metadata });
      }
    });
    if (!users.length || users.length < 100) break;
    page += 1;
  }

  console.log('Auth matches:', foundUsers.length);
  foundUsers.slice(0, 20).forEach((u) => console.log(u.id, u.email, u.metadata));

  console.log('\nSearching profiles table for username like:', target);
  const { data: profiles } = await client.from('profiles').select('username,balance').ilike('username', `%${target}%`).limit(100);
  console.log('Profiles matches:', (profiles || []).length);
  (profiles || []).forEach((p) => console.log(p));
}

run().catch((e) => { console.error(e); process.exit(2); });
