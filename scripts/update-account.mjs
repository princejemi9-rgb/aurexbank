// Server-only administrative correction, not a posted deposit.
// Dry-run: node --env-file=.env.local scripts/update-account.mjs --email=... --balance=... --country=... --phone=...
// Optional: --reserve=... --income=... --apply. Unspecified metrics are preserved.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountUpdatePlan } from './account-update-plan.mjs';

const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const split = argument.indexOf('=');
  return split < 0 ? [argument.replace(/^--/, ''), true] : [argument.slice(2, split), argument.slice(split + 1)];
}));
const allowed = new Set(['email', 'balance', 'reserve', 'income', 'country', 'phone', 'apply']);
assert.ok(Object.keys(options).every(key => allowed.has(key)), 'Unknown option');
assert.ok(options.apply === undefined || options.apply === true, 'Use --apply without a value');
assert.ok(typeof options.email === 'string' && options.email.includes('@'), 'Specify --email');
const email = options.email.trim().toLowerCase();
const changes = {};
for (const field of ['balance', 'reserve', 'income', 'country', 'phone']) {
  if (options[field] !== undefined) {
    assert.equal(typeof options[field], 'string', `Specify a value for --${field}`);
    assert.ok(options[field].trim(), `Empty --${field}`);
    changes[field] = ['balance', 'reserve', 'income'].includes(field) ? Number(options[field]) : options[field];
  }
}
assert.ok(Object.keys(changes).length, 'Specify at least one change');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && key, 'Missing server configuration');
async function request(path, init = {}) {
  const response = await fetch(url + path, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const allUsers = [];
for (let page = 1; ; page++) {
  const { users } = await request(`/auth/v1/admin/users?page=${page}&per_page=100`);
  allUsers.push(...users);
  if (users.length < 100) break;
}
const matches = allUsers.filter(user => user.email?.toLowerCase() === email);
assert.equal(matches.length, 1, 'Expected one existing Auth user');
const user = matches[0];
const username = user.user_metadata?.username || user.email;
const profiles = await request(`/rest/v1/profiles?select=*&username=eq.${encodeURIComponent(username)}`);
assert.equal(profiles.length, 1, 'Expected one existing profile');
const profile = profiles[0];
const plan = accountUpdatePlan(user, profile, changes);
console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', email, changed: plan.changed, metrics: plan.app_metadata.aurex_metrics, country: plan.user_metadata.country, phone: plan.user_metadata.phone }));
if (options.apply && plan.changed) {
  const backupDirectory = mkdtempSync(join(tmpdir(), 'aurex-account-update-'));
  writeFileSync(join(backupDirectory, 'before.json'), JSON.stringify({ user, profile, changes }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`Private backup: ${backupDirectory}`);
  const savedAt = new Date().toISOString();
  plan.user_metadata.admin_updated_at = savedAt;
  plan.app_metadata.aurex_metrics.updated_at = savedAt;
  // The backup and the saved Admin timestamp identify this as an administrative
  // correction. Do not invent an incoming payment or rewrite sign-in audit data.
  await request(`/rest/v1/profiles?id=eq.${profile.id}`, { method: 'PATCH', body: JSON.stringify({ balance: plan.profileBalance }) });
  await request(`/auth/v1/admin/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ user_metadata: plan.user_metadata, app_metadata: plan.app_metadata }) });
  const after = await request(`/auth/v1/admin/users/${user.id}`);
  const [afterProfile] = await request(`/rest/v1/profiles?id=eq.${profile.id}&select=*`);
  assert.equal(afterProfile.balance, plan.profileBalance);
  assert.deepEqual(after.user_metadata, plan.user_metadata);
  assert.deepEqual(after.app_metadata, plan.app_metadata);
  assert.equal(after.last_sign_in_at, user.last_sign_in_at, 'Sign-in timestamp changed during update');
  writeFileSync(join(backupDirectory, 'after.json'), JSON.stringify({ user: after, profile: afterProfile, operation: 'Administrative account correction', savedAt }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ verified: true, email, metrics: after.app_metadata.aurex_metrics, country: after.user_metadata.country, phone: after.user_metadata.phone }));

}
