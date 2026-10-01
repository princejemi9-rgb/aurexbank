// Run with: node --env-file=.env.local scripts/setup-dubley.mjs [--apply]
// Dry-run by default. Never creates Auth users or writes transactions/card credentials.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const email = 'dudbryan54@gmail.com';
const expectedId = '2aba957e-bbf0-4fca-bb54-0525592c6e4b';
const protectedEmails = ['francovercelli647@gmail.com', 'leonardodante731@gmail.com', 'antonioserg79@gmail.com', 'donaldlwie441@gmail.com', 'princejemi9@gmail.com'];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && key, 'Missing server-side Supabase configuration');

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function users() {
  const result = [];
  for (let page = 1; ; page++) {
    const data = await request(`/auth/v1/admin/users?page=${page}&per_page=100`);
    result.push(...data.users);
    if (data.users.length < 100) return result;
  }
}

async function profilesFor(user) {
  const aliases = [...new Set([user.email, user.email.split('@')[0], user.id, user.user_metadata?.username].filter(Boolean))];
  const rows = [];
  for (const alias of aliases) rows.push(...await request(`/rest/v1/profiles?select=*&username=eq.${encodeURIComponent(alias)}`));
  rows.push(...await request(`/rest/v1/profiles?select=*&id=eq.${user.id}`));
  return [...new Map(rows.map(row => [row.id, row])).values()];
}

const allUsers = await users();
const matches = allUsers.filter(user => user.email?.toLowerCase() === email);
assert.equal(matches.length, 1, 'Expected exactly one existing Auth user');
const user = matches[0];
assert.equal(user.id, expectedId, 'Auth identity changed; inspect before setup');
const profiles = await profilesFor(user);
assert.ok(profiles.length <= 1, 'Multiple profiles found; reconcile before setup');
const schema = await request('/rest/v1/');
for (const field of ['id', 'username', 'balance', 'full_name']) assert.ok(schema.definitions?.profiles?.properties?.[field], `Missing supported profile field: ${field}`);
const protectedUsers = allUsers.filter(user => protectedEmails.includes(user.email));
assert.equal(protectedUsers.length, 5, 'Expected all five protected accounts');
const protectedProfiles = await Promise.all(protectedUsers.map(profilesFor));
const metadata = user.user_metadata ?? {};
const profile = profiles[0];
const username = profile?.username || metadata.username || email;
const fullName = metadata.full_name || profile?.full_name || 'DUBLEY BRYAN';
const parts = fullName.trim().split(/\s+/);
const desiredMetadata = {
  ...metadata,
  username,
  full_name: fullName,
  first_name: metadata.first_name || `${parts[0][0].toUpperCase()}${parts[0].slice(1).toLowerCase()}`,
  last_name: metadata.last_name || parts.slice(1).join(' '),
  email: user.email,
  account_type: metadata.account_type || 'personal',
  currency: metadata.currency || 'USD',
  account_status: metadata.account_status || 'active',
  verification_status: metadata.verification_status || 'pending',
  transfer_frozen: metadata.transfer_frozen ?? false,
};
// Existing financial values, avatars, security settings and unknown identity fields are untouched.
const existingBalance = profile?.balance ?? user.app_metadata?.aurex_metrics?.balance ?? metadata.balance;
const balance = existingBalance ?? 0;
assert.ok(Number.isFinite(Number(balance)) && Number(balance) >= 0, 'Invalid existing balance');
// Use the confirmed Auth id: the live schema has no unique username constraint.
const insertProfile = { id: user.id, username, full_name: fullName, balance: Math.round(Number(balance)) };
const needsMetadata = JSON.stringify(metadata) !== JSON.stringify(desiredMetadata);
const apply = process.argv.includes('--apply');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', authId: user.id, email, profilePresent: !!profile, balanceAlreadyPresent: existingBalance !== undefined && existingBalance !== null, balance, metadataUpdate: needsMetadata, profileInsert: !profile }));

if (apply && (!profile || needsMetadata)) {
  const backupDirectory = mkdtempSync(join(tmpdir(), 'aurex-dubley-backup-'));
  writeFileSync(join(backupDirectory, 'before.json'), JSON.stringify({ user, profiles, protectedUsers, protectedProfiles }, null, 2), { mode: 0o600, flag: 'wx' });
  console.log(`Private backup: ${backupDirectory}`);
  if (!profile) await request('/rest/v1/profiles?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(insertProfile),
  });
  if (needsMetadata) await request(`/auth/v1/admin/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ user_metadata: desiredMetadata }) });
}

if (apply) {
  const updated = await request(`/auth/v1/admin/users/${user.id}`);
  const finalProfiles = await profilesFor(updated);
  assert.equal(finalProfiles.length, 1);
  assert.equal(finalProfiles[0].username, username);
  assert.equal(Number(finalProfiles[0].balance), profile ? Number(profile.balance) : Math.round(Number(balance)));
  for (const [field, value] of Object.entries(desiredMetadata)) assert.deepEqual(updated.user_metadata[field], value);
  assert.deepEqual(updated.app_metadata, user.app_metadata, 'Protected auth metadata must not change');
  const afterUsers = await users();
  for (let index = 0; index < protectedUsers.length; index++) {
    assert.deepEqual(afterUsers.find(item => item.id === protectedUsers[index].id), protectedUsers[index], 'Another Auth account changed during setup');
    assert.deepEqual(await profilesFor(protectedUsers[index]), protectedProfiles[index], 'Another profile changed during setup');
  }
  console.log(JSON.stringify({ verified: true, authId: updated.id, profileId: finalProfiles[0].id, fullName: updated.user_metadata.full_name, firstName: updated.user_metadata.first_name, lastName: updated.user_metadata.last_name, username, balance: finalProfiles[0].balance, avatarPresent: !!updated.user_metadata.avatar_url, accountStatus: updated.user_metadata.account_status, verificationStatus: updated.user_metadata.verification_status, transferFrozen: updated.user_metadata.transfer_frozen, protectedAccountsUnchanged: true }));
}
