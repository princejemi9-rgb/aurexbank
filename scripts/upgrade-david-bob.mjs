// Prepared, idempotent administrative update for the existing David Bob account.
// It is dry-run by default and never creates a user, a card, payment credentials,
// ledger entries, or transfer history. Add --apply only after production approval.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const apply = process.argv.slice(2);
assert.ok(apply.length === 0 || (apply.length === 1 && apply[0] === '--apply'), 'Use --apply without a value');
const args = [
  '--email=Davidbob9784@gmail.com',
  '--balance=7284650.75',
  '--country=United States',
  '--phone=+1 (202) 555-0147 (placeholder; unverified)',
  '--first_name=David',
  '--last_name=Bob',
  '--full_name=David Bob',
  '--account_type=personal',
  '--currency=USD',
  '--account_status=active',
  '--card_holder_name=DAVID BOB',
  '--card_status=active',
  ...apply,
];
const result = spawnSync(process.execPath, ['scripts/update-account.mjs', ...args], {
  stdio: 'inherit',
  env: process.env,
});
process.exitCode = result.status ?? 1;
