import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);

test('history preserves legacy dollar amounts and cents, recorded status and UTC dates', () => {
  const { mapHistoryRecord } = load('src/lib/transactionHistory.ts', {});
  const legacy = mapHistoryRecord({ id: 1, sender: 'franco', receiver: 'recipient', amount: 50, created_at: '2025-12-01T00:00:00Z' }, 'franco');
  assert.equal(legacy.amount, -50);
  assert.equal(legacy.status, 'Not recorded');
  assert.equal(legacy.time, 'Dec 1, 2025');
  const cents = mapHistoryRecord({ id: 2, sender: 'sender', receiver: 'franco', amount: 12525, account_type: 'personal:cents', status: 'Pending', created_at: '2026-09-01T00:00:00Z' }, 'franco');
  assert.equal(cents.amount, 125.25);
  assert.equal(cents.status, 'Pending');
  assert.equal(cents.createdAt, '2026-09-01T00:00:00Z');
});

test('illustrative history covers every month through September 2026 without entering the live ledger', () => {
  const { buildIllustrativeHistory, getIllustrativePresentation } = load('src/lib/illustrativeHistory.ts', {});
  const records = buildIllustrativeHistory('Franco Vercelli', 'francovercelli647@gmail.com');
  const fees = records.filter(record => record.type === 'Service fee');
  assert.equal(fees.length, 57);
  assert.equal(fees[0].createdAt.slice(0, 7), '2026-09');
  assert.equal(fees.at(-1).createdAt.slice(0, 7), '2022-01');
  assert.equal(fees.every(record => record.amount === -50 && record.illustrative === true), true);
  assert.equal(records.some(record => record.status !== 'Presentation'), false);
  const accounts = [
    ['Franco Vercelli', 'francovercelli647@gmail.com'], ['Leonardo Dante', 'leonardodante731@gmail.com'],
    ['Antonio Sergio', 'antonioserg79@gmail.com'], ['Donald Lwie', 'donaldlwie441@gmail.com'], ['Prince Jemigbe', 'princejemi9@gmail.com'],
  ].map(([name, email]) => getIllustrativePresentation(name, email));
  assert.equal(new Set(accounts.map(account => account.income)).size, 5);
  assert.equal(new Set(accounts.map(account => account.reserve)).size, 5);
  assert.equal(accounts.every(account => account.records.filter(record => record.type === 'Service fee').length === 57), true);
});

function load(file, mocks, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => name in mocks ? mocks[name] : name === './accountExperience' ? load('src/lib/accountExperience.ts', {}) : require(name), ...globals });
  return exports;
}

function onboarding({ metadata = {}, profileError = null, userId = 'user-1' } = {}) {
  const writes = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: userId, email: 'new@example.com', user_metadata: metadata } }, error: null }),
      admin: { updateUserById: async (...args) => { writes.push(['metadata', ...args]); return { error: null }; } },
    },
    from: table => ({
      upsert: async (...args) => { writes.push([table, ...args]); return { error: profileError }; },
      insert: async rows => { writes.push([table, rows]); return { error: null }; },
    }),
  };
  const route = load('app/api/auth/onboard/route.ts', {
    '@supabase/supabase-js': { createClient: () => client },
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.com', SUPABASE_SERVICE_ROLE_KEY: 'test-key' } } });
  return { writes, post: token => route.POST({ json: async () => ({ userId: 'user-1', email: 'new@example.com' }), headers: { get: () => token } }) };
}

test('onboarding requires authentication and rejects another user', async () => {
  const missing = onboarding();
  assert.equal((await missing.post(null)).status, 401);
  assert.equal(missing.writes.length, 0);
  const mismatch = onboarding({ userId: 'another-user' });
  assert.equal((await mismatch.post('Bearer token')).status, 403);
  assert.equal(mismatch.writes.length, 0);
});
test('new profile starts at zero and does not overwrite existing account controls', async () => {
  const scenario = onboarding({ metadata: { balance: 999999, first_name: 'New', account_type: 'personal' } });
  assert.equal((await scenario.post('Bearer token')).status, 200);
  const [, profile, options] = scenario.writes.find(([table]) => table === 'profiles');
  assert.equal(profile.balance, 0);
  assert.equal(profile.verification_status, 'pending');
  assert.equal(options.ignoreDuplicates, true);
});
test('profile failure is reported and does not mark onboarding complete', async () => {
  const scenario = onboarding({ profileError: { message: 'database unavailable' } });
  assert.equal((await scenario.post('Bearer token')).status, 503);
  assert.equal(scenario.writes.some(([table]) => table === 'metadata'), false);
});
test('completed onboarding does not repeat mutations', async () => {
  const scenario = onboarding({ metadata: { onboarded_at: '2026-01-01' } });
  assert.equal((await scenario.post('Bearer token')).status, 200);
  assert.equal(scenario.writes.length, 0);
});

function registration(result) {
  const states = [];
  const redirects = [];
  const requests = [];
  const valid = { email: ' New@Example.com ', password: 'StrongPass123', confirmPassword: 'StrongPass123', firstName: 'New', lastName: 'Customer', phone: '12345678901', dateOfBirth: '1990-01-01', nationality: 'US', address: '1 Main St', city: 'City', state: 'State', postalCode: '12345', country: 'US', idType: 'passport', idNumber: '12345', occupation: 'employed', annualIncome: '50000', agreeToTerms: true, agreeToPrivacy: true };
  const jsx = (type, props) => ({ type, props });
  const page = load('app/auth/signup/page.tsx', {
    react: { useEffect: () => {}, useState: initial => [initial === 'account' ? 'kyc' : initial && typeof initial === 'object' && 'email' in initial ? { ...initial, ...valid } : initial, value => states.push(value)] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/link': { default: 'a' },
    'next/navigation': { useRouter: () => ({ replace: path => redirects.push(path) }) },
    '../../../src/lib/supabase': { supabase: { auth: { signUp: async args => { requests.push(args); return result; } } } },
    '../../../src/components/brand/AurexBrand': { default: 'brand' },
    '../../../src/components/ui/AppIcon': { default: 'icon' },
  }, { window: { location: { origin: 'https://bank.example' } }, fetch: async () => ({ ok: true }) });
  const nodes = [];
  function walk(node) { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return; nodes.push(node); walk(node.props?.children); }
  walk(page.default());
  const submit = nodes.find(node => node.type === 'button' && node.props.children === 'Create Account');
  return { states, redirects, requests, submit: submit.props.onClick };
}
test('registration without a session explains email and passcode verification', async () => {
  const scenario = registration({ data: { user: { id: 'user-1', identities: [{}] }, session: null }, error: null });
  await scenario.submit();
  assert.ok(scenario.states.includes('complete'));
  assert.ok(scenario.states.some(value => typeof value === 'string' && value.includes('administrator-issued security passcode')));
  assert.equal(scenario.redirects.length, 0);
  assert.equal(scenario.requests[0].email, 'new@example.com');
});
test('registration with a session goes to security verification, not directly to dashboard', async () => {
  const scenario = registration({ data: { user: { id: 'user-1', email: 'new@example.com', identities: [{}] }, session: { access_token: 'test-token' } }, error: null });
  await scenario.submit();
  assert.deepEqual(scenario.redirects, ['/security/verify']);
});
test('duplicate registration does not claim successful account creation', async () => {
  const scenario = registration({ data: { user: { id: 'hidden', identities: [] }, session: null }, error: null });
  await scenario.submit();
  assert.equal(scenario.states.includes('complete'), false);
  assert.ok(scenario.states.some(value => typeof value === 'string' && value.includes('already have an account')));
});

test('full identity registration retains identity details and requires security verification', async () => {
  const scenario = registration({ data: { user: { id: 'user-1', identities: [{}] }, session: { access_token: 'test-token' } }, error: null });
  await scenario.submit();
  assert.equal(scenario.requests[0].options.data.id_number, '12345');
  assert.equal(scenario.requests[0].options.data.verification_status, 'pending');
  assert.equal(scenario.requests[0].options.data.kyc_skipped, false);
  assert.deepEqual(scenario.redirects, ['/security/verify']);
});

test('security verification rejects missing and incorrect passcodes, then accepts the correct code', async () => {
  let configured = true;
  let sessions = 0;
  const route = load('app/api/auth/security-verify/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '../../../../src/lib/server/supabaseAuth': { getSupabaseUser: async () => ({ user: { id: 'user-1', email: 'new@example.com', app_metadata: { passcode: {} } } }) },
    '../../../../src/lib/server/securityPasscode': {
      PASSCODE_METADATA_KEY: 'passcode', readSecurityPasscode: () => configured ? { revision: 'revision-1' } : null,
      validatePasscodeInput: value => typeof value === 'string' && value.length >= 6,
      verifySecurityPasscode: value => value === 'correct-code',
    },
    '../../../../src/lib/server/securitySession': { createSecuritySession: () => 'signed-session', setSecuritySession: () => { sessions++; } },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.com', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key' } } });
  const request = passcode => ({ json: async () => ({ passcode }), headers: { get: () => 'Bearer token' } });
  assert.equal((await route.POST(request(''))).status, 400);
  assert.equal((await route.POST(request('wrong-code'))).status, 401);
  configured = false;
  assert.equal((await route.POST(request('correct-code'))).status, 403);
  assert.equal(sessions, 0);
  configured = true;
  assert.equal((await route.POST(request('correct-code'))).status, 200);
  assert.equal(sessions, 1);
});

test('dashboard authorization requires a security session matching both user and passcode revision', async () => {
  let session = null;
  const route = load('app/api/auth/security-status/route.ts', {
    'next/server': { NextResponse: { json: body => ({ body }) } },
    '../../../../src/lib/server/supabaseAuth': { getSupabaseUser: async () => ({ user: { id: 'user-1', email: 'new@example.com', app_metadata: { passcode: {} } } }) },
    '../../../../src/lib/server/securityPasscode': { PASSCODE_METADATA_KEY: 'passcode', readSecurityPasscode: () => ({ revision: 'revision-1' }) },
    '../../../../src/lib/server/securitySession': { SECURITY_SESSION_COOKIE: 'security', readSecuritySession: () => session },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.com', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key' } } });
  const request = { headers: { get: () => 'Bearer token' }, cookies: { get: () => ({ value: 'cookie' }) } };
  assert.equal((await route.GET(request)).body.verified, false);
  session = { userId: 'another-user', revision: 'revision-1' };
  assert.equal((await route.GET(request)).body.verified, false);
  session = { userId: 'user-1', revision: 'expired-revision' };
  assert.equal((await route.GET(request)).body.verified, false);
  session = { userId: 'user-1', revision: 'revision-1' };
  assert.equal((await route.GET(request)).body.verified, true);
});


test('Dubley history is deterministic, spans five years, and stops before March 2026', () => {
  const { buildIllustrativeHistory, getAccountOverviewMetrics } = load('src/lib/illustrativeHistory.ts', {});
  const records = buildIllustrativeHistory('DUBLEY BRYAN', 'dudbryan54@gmail.com');
  assert.equal(records.length, 195);
  assert.equal(records.at(-1).createdAt, '2021-03-01T00:00:00.000Z');
  assert.equal(records[0].createdAt, '2026-02-18T00:00:00.000Z');
  assert.equal(new Set(records.map(record => record.createdAt.slice(0, 7))).size, 60);
  assert.equal(new Set(records.map(record => record.id)).size, records.length);
  assert.ok(records.every(record => record.illustrative && record.status === 'Presentation' && record.createdAt < '2026-03-01'));
  assert.ok(records.some(record => record.name === 'Northstar Consulting Payroll'));
  assert.ok(records.some(record => record.name === 'Greenwood Property Management'));
  assert.equal(JSON.stringify(records), JSON.stringify(buildIllustrativeHistory('Updated name', ' DUDBRYAN54@GMAIL.COM ')));
  const stored = getAccountOverviewMetrics('DUBLEY BRYAN', 'dudbryan54@gmail.com', { income: 123, reserve: 456 });
  assert.equal(stored.income, 123);
  assert.equal(stored.reserve, 456);
  assert.equal(stored.illustrative, false);
  const legacyAlias = getAccountOverviewMetrics('', 'antonioserg79', { income: 0, reserve: 0 }, 'antonioserg79@gmail.com');
  assert.equal(legacyAlias.income, load('src/lib/illustrativeHistory.ts', {}).getIllustrativePresentation('', 'antonioserg79').income);
  assert.equal(getAccountOverviewMetrics('', 'dudbryan54@gmail.com', { income: 0, reserve: 0 }).income, 0);
  const { filterHistory } = load('src/lib/transactionHistory.ts', {});
  const real = { id: 'posted-after-cutoff', name: 'Actual transfer', amount: 12, type: 'Income', status: 'Completed', method: 'Transfer', createdAt: '2026-09-30T12:00:00.000Z', time: 'Sep 30, 2026' };
  const merged = filterHistory([...records, real], '', 'all', 'all');
  assert.equal(merged[0].id, real.id);
  assert.equal(merged.length, records.length + 1);
});

test('Dubley uses account-specific digital debit display fields', () => {
  const { getAccountExperience } = load('src/lib/accountExperience.ts', {});
  const { createCardPreview } = load('src/lib/cardPreview.ts', {});
  assert.equal(getAccountExperience(' DUDBRYAN54@GMAIL.COM ').previewCard, true);
  assert.equal(getAccountExperience('francovercelli647@gmail.com').previewCard, false);
  const card = createCardPreview('2aba957e-bbf0-4fca-bb54-0525592c6e4b', 'DUBLEY BRYAN');
  assert.equal(card.holder, 'DUBLEY BRYAN');
  assert.equal(card.issuerCard, false);
  assert.equal(card.number, '•••• •••• •••• 4827');
  assert.equal(card.expiry, '12/29');
  for (const field of ['pin', 'token', 'cvv']) assert.equal(field in card, false);
});


test('Dubley compact card links to management and the card page shows complete fields', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const profile = { userId: '2aba957e-bbf0-4fca-bb54-0525592c6e4b', email: 'dudbryan54@gmail.com', fullName: 'DUBLEY BRYAN' };
  const { default: BankCard } = load('src/components/cards/BankCard.tsx', {
    'next/link': ({ children, ...props }) => React.createElement('a', props, children),
    '../../context/BankingContext': { useBanking: () => ({ currentProfile: profile }) },
    '../../context/BrandingContext': { useBranding: () => ({ branding: { bankName: 'Aurex Bank' } }) },
    '../../lib/accountExperience': load('src/lib/accountExperience.ts', {}),
    '../../lib/cardPreview': load('src/lib/cardPreview.ts', {}),
    '../../lib/cardDetails': { createCardDetails: () => { throw new Error('Preview must never generate payment credentials'); } },
    '../../lib/cardPreferences': {},
    '../brand/AurexBrand': { AurexMark: () => null },
    '../ui/AppIcon': () => null,
  });
  for (const compact of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(BankCard, { compact }));
    assert.match(html, /DUBLEY BRYAN/);
    assert.match(html, /Aurex Bank/);
    assert.match(html, /mastercard/);
    assert.match(html, /•••• •••• •••• 4827/);
    assert.match(html, /Valid thru/);
    assert.doesNotMatch(html, /Awaiting issuer|Preview|Illustrative/);
    if (compact) assert.match(html, /href="\/cards"/);
  }
});


test('administrative account updates preserve exact cents, unrelated metadata and unspecified metrics', async () => {
  const { accountUpdatePlan } = await import('./account-update-plan.mjs');
  const user = {
    user_metadata: { full_name: 'DUBLEY BRYAN', country: '', phone: '', balance: 0, reserve: 10, income: 20, account_status: 'active', transfer_frozen: false },
    app_metadata: { aurex_security_passcode: { revision: 'keep' }, aurex_metrics: { balance: 0, reserve: 125.25, income: 250.75 } },
  };
  const snapshot = JSON.stringify(user);
  const plan = accountUpdatePlan(user, { balance: 0 }, { balance: 7675896.68, country: 'United States', phone: '+13099067589' });
  assert.equal(plan.app_metadata.aurex_metrics.balance, 7675896.68);
  assert.equal(plan.user_metadata.balance, 7675896.68);
  assert.equal(plan.profileBalance, 7675897);
  assert.equal(plan.app_metadata.aurex_metrics.reserve, 125.25);
  assert.equal(plan.app_metadata.aurex_metrics.income, 250.75);
  assert.equal(plan.user_metadata.country, 'United States');
  assert.equal(plan.user_metadata.phone, '+13099067589');
  assert.equal(plan.app_metadata.aurex_security_passcode.revision, 'keep');
  assert.equal(JSON.stringify(user), snapshot);
  assert.equal(accountUpdatePlan(plan, { balance: plan.profileBalance }, { balance: 7675896.68 }).changed, false);
  for (const value of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER]) assert.throws(() => accountUpdatePlan(user, { balance: 0 }, { balance: value }));
});

test('access summary uses recorded sign-in time and never infers login location from residence', () => {
  const { renderToStaticMarkup } = require('react-dom/server');
  const React = require('react');
  const { default: Summary } = load('src/components/profile/AccountAccessSummary.tsx', {
    react: { ...React, useEffect: () => {}, useState: () => [{ userId: 'dubley', signedInAt: '2026-02-28T12:30:00.000Z', error: false }, () => {}] },
    '../../context/BankingContext': { useBanking: () => ({ currentProfile: { userId: 'dubley', country: 'United States' } }) },
    '../../lib/supabase': {},
  });
  const html = renderToStaticMarkup(React.createElement(Summary));
  assert.match(html, /2026-02-28T12:30:00.000Z/);
  assert.match(html, /Location unavailable/);
  assert.doesNotMatch(html, /Nigeria|United States|Trusted|Secure/);
});


test('available balance overview renders all cents without generated labels for Dubley', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const amounts = load('src/components/ui/PrivateAmount.tsx', {
    '../../context/BalancePrivacyContext': { useBalancePrivacy: () => ({ balancesHidden: false }) },
    './AppIcon': () => null,
  });
  const { default: Stats } = load('src/components/widgets/StatsGrid.tsx', {
    '../../context/BankingContext': { useBanking: () => ({ balance: 7675896.68, income: 0, reserve: 0, expenses: 0, currentProfile: { fullName: 'DUBLEY BRYAN', email: 'dudbryan54@gmail.com', username: 'dudbryan54@gmail.com' } }) },
    '../../lib/illustrativeHistory': load('src/lib/illustrativeHistory.ts', {}),
    '../ui/PrivateAmount': amounts,
  });
  const html = renderToStaticMarkup(React.createElement(Stats));
  assert.match(html, /\$7,675,896\.68/);
  assert.doesNotMatch(html, /Generated estimate|Illustrative/);
});
