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

test('David Bob simulated history follows the requested historical period and filters by effective date', () => {
  const { buildIllustrativeHistory } = load('src/lib/illustrativeHistory.ts', {});
  const { filterHistory } = load('src/lib/transactionHistory.ts', {});
  const records = buildIllustrativeHistory('David Bob', 'davidbob9784@gmail.com');
  assert.equal(records.filter(record => record.type === 'Service fee').every(record => record.createdAt.slice(0, 4) >= '2021' && record.createdAt.slice(0, 4) <= '2026'), true);
  assert.equal(records[0].effectiveAt.slice(0, 7), '2026-03');
  assert.equal(records.at(-1).effectiveAt.slice(0, 7), '2021-10');
  assert.ok(records.some(record => record.name === 'Michael Anderson'));
  assert.ok(records.some(record => record.name === 'Westbridge Holdings LLC'));
  const newest = { ...records[0], id: 'effective-newest', type: 'Income', effectiveAt: '2026-03-31T00:00:00.000Z', createdAt: '2021-10-01T00:00:00.000Z', category: 'Investment distribution' };
  const filtered = filterHistory([...records, newest], '', 'all', '2026', 'Investment distribution', 'Income');
  assert.equal(filtered[0].id, 'effective-newest');
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
  const valid = { email: ' New@Example.com ', password: 'StrongPass123', confirmPassword: 'StrongPass123', firstName: 'New', lastName: 'Customer', phone: '75545678901', dateOfBirth: '1990-01-01', nationality: 'US', address: '1 Main St', city: 'City', state: 'State', postalCode: '75545', country: 'US', idType: 'passport', idNumber: '75545', occupation: 'employed', annualIncome: '50000', agreeToTerms: true, agreeToPrivacy: true };
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
test('registration without a session explains email confirmation without requiring a dashboard passcode', async () => {
  const scenario = registration({ data: { user: { id: 'user-1', identities: [{}] }, session: null }, error: null });
  await scenario.submit();
  assert.ok(scenario.states.includes('complete'));
  assert.ok(scenario.states.some(value => typeof value === 'string' && value.includes('Check your email for a confirmation link')));
  assert.equal(scenario.redirects.length, 0);
  assert.equal(scenario.requests[0].email, 'new@example.com');
});
test('registration with a session goes directly to the dashboard', async () => {
  const scenario = registration({ data: { user: { id: 'user-1', email: 'new@example.com', identities: [{}] }, session: { access_token: 'test-token' } }, error: null });
  await scenario.submit();
  assert.deepEqual(scenario.redirects, ['/dashboard']);
});
test('duplicate registration does not claim successful account creation', async () => {
  const scenario = registration({ data: { user: { id: 'hidden', identities: [] }, session: null }, error: null });
  await scenario.submit();
  assert.equal(scenario.states.includes('complete'), false);
  assert.ok(scenario.states.some(value => typeof value === 'string' && value.includes('already have an account')));
});

test('full identity registration retains identity details and opens the dashboard', async () => {
  const scenario = registration({ data: { user: { id: 'user-1', identities: [{}] }, session: { access_token: 'test-token' } }, error: null });
  await scenario.submit();
  assert.equal(scenario.requests[0].options.data.id_number, '75545');
  assert.equal(scenario.requests[0].options.data.verification_status, 'pending');
  assert.equal(scenario.requests[0].options.data.kyc_skipped, false);
  assert.deepEqual(scenario.redirects, ['/dashboard']);
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

test('transfer passcode status requires a security session matching both user and passcode revision', async () => {
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
  assert.ok(!records.some(record => record.name === 'Aurex Reserve Transfer'));
  assert.equal(new Set(records.filter(record => record.type === 'Income').map(record => record.name)).size, 60);
  assert.equal(new Set(records.filter(record => record.type === 'Savings allocation').map(record => record.name)).size, 60);
  assert.ok(records.some(record => record.name === 'Avery Bennett'));
  assert.ok(records.filter(record => record.type === 'Service fee').every(record => record.amount === -50));
  assert.ok(records.filter(record => record.type !== 'Service fee').every(record => Math.abs(record.amount) >= 5000));
  assert.ok(records.some(record => Math.abs(record.amount) >= 50000));
  assert.ok(records.some(record => Math.abs(record.amount) >= 100000));
  assert.ok(records.some(record => Math.abs(record.amount) >= 200000));
  assert.ok(new Set(records.filter(record => record.amount > 0).map(record => record.amount)).size >= 10);
  assert.ok(new Set(records.filter(record => record.amount < 0 && record.type !== 'Service fee').map(record => record.amount)).size >= 10);
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
  assert.equal(getAccountExperience('francovercelli647@gmail.com').previewCard, true);
  const card = createCardPreview('2aba957e-bbf0-4fca-bb54-0525592c6e4b', 'DUBLEY BRYAN');
  assert.equal(card.holder, 'DUBLEY BRYAN');
  assert.equal(card.issuerCard, false);
  assert.equal(card.number, '•••• •••• •••• 7554');
  assert.match(card.previewIdentifier, /^\d{4} \d{4} \d{4} 7554$/);
  assert.match(card.previewIdentifier, /^9495 \d{4} \d{4} 7554$/);
  assert.equal(card.expiry, '12/29');
  assert.equal(card.securityCode, '581');
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
    assert.match(html, /•••• •••• •••• 7554/);
    assert.match(html, /Valid thru/);
    assert.doesNotMatch(html, /Awaiting issuer|Illustrative/);
    if (!compact) assert.match(html, /Preview identifier/);
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

test('David Bob update plan is idempotent and only supplies a visual virtual-card identity', async () => {
  const { accountUpdatePlan } = await import('./account-update-plan.mjs');
  const user = { user_metadata: { username: 'Davidbob9784@gmail.com' }, app_metadata: {} };
  const changes = { balance: 7284650.75, full_name: 'David Bob', country: 'United States', phone: '+1 (202) 555-0147 (placeholder; unverified)', account_type: 'personal', currency: 'USD', account_status: 'active', card_holder_name: 'DAVID BOB', card_status: 'active' };
  const first = accountUpdatePlan(user, { balance: 0 }, changes);
  assert.equal(first.app_metadata.aurex_metrics.balance, 7284650.75);
  assert.equal(first.user_metadata.full_name, 'David Bob');
  assert.equal(first.user_metadata.first_name, 'David');
  assert.equal(first.user_metadata.last_name, 'Bob');
  assert.equal(first.user_metadata.card_holder_name, 'DAVID BOB');
  assert.equal(first.user_metadata.card_status, 'active');
  assert.equal(accountUpdatePlan(first, { balance: first.profileBalance }, changes).changed, false);
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

test('Personal Admin entry routes are public while operational access remains role-protected', async () => {
  const authGate = readFileSync(new URL('../src/components/auth/AuthGate.tsx', import.meta.url), 'utf8');
  const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
  const publicRoutes = authGate.match(/const PUBLIC_ROUTES = \[([\s\S]*?)\];/)?.[1] || '';
  for (const path of ['"/personal-admin"', '"/personal-admin/register"', '"/personal-admin/login"']) {
    assert.match(publicRoutes, new RegExp(path));
  }
  assert.match(authGate, /return PUBLIC_ROUTES\.includes\(pathname\)/);
  assert.match(proxy, /Passcode step-up is/);
  assert.doesNotMatch(proxy, /url\.pathname = "\/login"/);

  const route = load('app/api/personal-admin/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '../../../src/lib/server/tenantAccess': { serviceClient: () => null, requestUser: async () => null, approvedPersonalAdmin: async () => null },
  });
  const response = await route.GET({ headers: { get: () => '' } });
  assert.equal(response.status, 401);
  assert.equal(response.body.ok, false);
});

test('Personal Admin sign-in uses its own form and lets an existing authenticated account activate a registration', () => {
  const page = readFileSync(new URL('../app/personal-admin/login/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /signInWithPassword/);
  assert.match(page, /personalAdminRequest/);
  assert.match(page, /ACCESS_CHECK_TIMEOUT_MS = 8000/);
  assert.match(page, /new FormData\(event\.currentTarget as HTMLFormElement\)/);
  assert.match(page, /name="email"/);
  assert.match(page, /name="password"/);
  assert.match(page, /Personal Admin access check timed out/);
  assert.match(page, /Sign in as Personal Admin/);
  assert.match(page, /Complete Personal Admin registration/);
  assert.match(page, /Activate Personal Admin access/);
  assert.match(page, /restorePersonalAdminFlow/);
  assert.match(page, /Complete the Personal Admin registration below/);
  assert.match(page, /router\.replace\("\/personal-admin\/dashboard"\)/);
  assert.match(page, /method: "POST"/);
  assert.doesNotMatch(page, /if \(!response\.ok \|\| !result\?\.personalAdmin\) \{\s*await supabase\.auth\.signOut/);
  assert.doesNotMatch(page, /href="\/auth\/signin"/);
});

test('Personal Admin role lookup settles before transfer-only passcode routing can run', () => {
  const authGate = readFileSync(new URL('../src/components/auth/AuthGate.tsx', import.meta.url), 'utf8');
  assert.match(authGate, /setSecurityVerified\(null\);/);
  assert.match(authGate, /setSecurityLoading\(true\);/);
  assert.match(authGate, /ROLE_LOOKUP_TIMEOUT_MS = 8000/);
  assert.match(authGate, /const personalResponse = await fetchWithTimeout\("\/api\/personal-admin"/);
  assert.match(authGate, /if \(!personalResponse\?\.ok\) \{/);
  assert.match(authGate, /setPersonalAdmin\(personalData\.personalAdmin\);[\s\S]*?setSecurityVerified\(true\);[\s\S]*?setSecurityLoading\(false\);/);
  assert.match(authGate, /pathname === "\/send" && !securityVerified/);
  assert.doesNotMatch(authGate, /if \(!securityVerified\) \{\s*router\.replace\("\/security\/verify"/);
});

test('an unrecognised session stays on the dedicated Personal Admin form instead of entering customer login', () => {
  const authGate = readFileSync(new URL('../src/components/auth/AuthGate.tsx', import.meta.url), 'utf8');
  assert.match(authGate, /pathname === "\/personal-admin\/login" \|\| pathname === "\/personal-admin\/register"\) return;/);
  assert.match(authGate, /if \(pathname === "\/personal-admin\/login" \|\| pathname === "\/personal-admin\/register"\) \{\s*return <>\{children\}<\/>;/);
  assert.match(authGate, /if \(isPublic && !hasSession\)/);
  assert.match(authGate, /if \(isPublic && pathname !== "\/dashboard"\) \{/);
});

test('passcode verification is required only for transfers and is bound to the authenticated user', () => {
  const authGate = readFileSync(new URL('../src/components/auth/AuthGate.tsx', import.meta.url), 'utf8');
  const transferRoute = readFileSync(new URL('../app/api/transfers/route.ts', import.meta.url), 'utf8');
  const signIn = readFileSync(new URL('../app/auth/signin/page.tsx', import.meta.url), 'utf8');
  const verify = readFileSync(new URL('../app/security/verify/page.tsx', import.meta.url), 'utf8');
  assert.match(authGate, /router\.replace\("\/security\/verify\?next=%2Fsend"\)/);
  assert.match(transferRoute, /readSecuritySession\(request\.cookies\.get\(SECURITY_SESSION_COOKIE\)\?\.value\)/);
  assert.match(transferRoute, /securitySession\.userId !== user\.id/);
  assert.match(signIn, /router\.replace\("\/dashboard"\)/);
  assert.match(signIn, /new FormData\(e\.currentTarget as HTMLFormElement\)/);
  assert.match(signIn, /name="email"/);
  assert.match(signIn, /name="password"/);
  assert.match(verify, /new URLSearchParams\(window\.location\.search\)\.get\("next"\) === "\/send"/);
  assert.match(verify, /window\.location\.replace\(next\)/);
});

test('transfer execution rejects a missing or another user’s passcode session', async () => {
  let securitySession = null;
  const route = load('app/api/transfers/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'customer-1', user_metadata: {} } }, error: null }) } }) },
    '../../../src/lib/server/securitySession': { SECURITY_SESSION_COOKIE: 'security', readSecuritySession: () => securitySession },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.com', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key' } } });
  const request = { headers: { get: () => 'Bearer access-token' }, cookies: { get: () => ({ value: 'signed-cookie' }) }, json: async () => null };
  assert.equal((await route.POST(request)).status, 403);
  securitySession = { userId: 'customer-2' };
  assert.equal((await route.POST(request)).status, 403);
  securitySession = { userId: 'customer-1' };
  assert.equal((await route.POST(request)).status, 400);
});

test('an authenticated Personal Admin may open the public homepage but not customer routes', () => {
  const authGate = readFileSync(new URL('../src/components/auth/AuthGate.tsx', import.meta.url), 'utf8');
  assert.match(authGate, /if \(pathname === "\/"\) return;/);
  assert.match(authGate, /if \(!pathname\.startsWith\("\/personal-admin"\)\) \{ router\.replace\("\/personal-admin\/dashboard"\); \}/);
});

test('Personal Admin portfolio routes require explicit customer-management permission', async () => {
  const db = { from: () => { throw new Error('portfolio query must not run'); } };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '../../../../src/lib/server/tenantAccess': { serviceClient: () => db, requestUser: async () => ({ id: 'admin-1' }), approvedPersonalAdmin: async () => ({ status: 'approved', permissions: { manage_customers: false } }) },
  };
  const request = { headers: { get: () => 'Bearer token' } };
  const customers = load('app/api/personal-admin/customers/route.ts', mocks);
  const transactions = load('app/api/personal-admin/transactions/route.ts', mocks);
  const cards = load('app/api/personal-admin/cards/route.ts', mocks);
  const notifications = load('app/api/personal-admin/notifications/route.ts', mocks);
  const support = load('app/api/personal-admin/support/route.ts', mocks);
  for (const route of [customers, transactions, cards, notifications, support]) {
    const response = await route.GET(request);
    assert.equal(response.status, 403);
    assert.equal(response.body.ok, false);
  }
});

test('Personal Admin customer creation creates a confirmed Auth account then atomically creates the assigned account', async () => {
  const calls = [];
  const db = {
    auth: { admin: {
      createUser: async (...args) => { calls.push(['create', ...args]); return { data: { user: { id: 'customer-1' } }, error: null }; },
      deleteUser: async (...args) => { calls.push(['delete', ...args]); return { error: null }; },
    } },
    rpc: async (...args) => { calls.push(['rpc', ...args]); return { data: { referral_code: 'PA-EXAMPLE' }, error: null }; },
  };
  const route = load('app/api/personal-admin/customers/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '../../../../src/lib/server/tenantAccess': {
      serviceClient: () => db, requestUser: async () => ({ id: 'admin-1' }),
      approvedPersonalAdmin: async () => ({ status: 'approved', referral_code: 'PA-EXAMPLE', permissions: { manage_customers: true } }),
    },
  });
  const response = await route.POST({
    headers: { get: () => 'Bearer token' },
    json: async () => ({ fullName: 'New Customer', email: 'customer@example.com', phone: '+234 800 000 0000', initialPassword: 'InitialPass1', country: 'Nigeria', accountType: 'personal', address: '1 Example Street' }),
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.customer.initialPasswordChangeRequired, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['create', {
    email: 'customer@example.com', password: 'InitialPass1', email_confirm: true,
    user_metadata: { full_name: 'New Customer', first_name: 'New', last_name: 'Customer', phone: '+234 800 000 0000', country: 'Nigeria', account_type: 'personal', personal_admin_created: true, email_verification_status: 'administratively_confirmed_not_proof_of_ownership', onboarded_at: calls[0][1].user_metadata.onboarded_at, referral_code: 'PA-EXAMPLE' },
  }]);
  assert.equal(calls[1][0], 'rpc');
  assert.equal(calls[1][1], 'create_personal_admin_customer_account');
  assert.equal(calls[1][2].p_personal_admin_id, 'admin-1');
  assert.equal(calls[1][2].p_customer_id, 'customer-1');
  assert.equal(calls.some(([name]) => name === 'delete'), false);
});

test('Personal Admin customer creation rejects unauthorized access and compensates for a failed database transaction', async () => {
  const deniedRoute = load('app/api/personal-admin/customers/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '../../../../src/lib/server/tenantAccess': { serviceClient: () => ({}), requestUser: async () => ({ id: 'admin-1' }), approvedPersonalAdmin: async () => ({ status: 'approved', permissions: { manage_customers: false } }) },
  });
  const denied = await deniedRoute.POST({ headers: { get: () => 'Bearer token' }, json: async () => ({}) });
  assert.equal(denied.status, 403);
  let removed = false;
  const db = { auth: { admin: { createUser: async () => ({ data: { user: { id: 'customer-1' } }, error: null }), deleteUser: async () => { removed = true; return { error: null }; } } }, rpc: async () => ({ data: null, error: { message: 'transaction failed' } }) };
  const failedRoute = load('app/api/personal-admin/customers/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '../../../../src/lib/server/tenantAccess': { serviceClient: () => db, requestUser: async () => ({ id: 'admin-1' }), approvedPersonalAdmin: async () => ({ status: 'approved', referral_code: 'PA-EXAMPLE', permissions: { manage_customers: true } }) },
  });
  const failed = await failedRoute.POST({ headers: { get: () => 'Bearer token' }, json: async () => ({ fullName: 'New Customer', email: 'customer@example.com', phone: '+234 800 000 0000', initialPassword: 'InitialPass1', country: 'Nigeria', accountType: 'personal' }) });
  assert.equal(failed.status, 503);
  assert.equal(removed, true);
});

test('Personal Admin-created customers are confirmed for sign-in but must replace their initial password', () => {
  const migration = readFileSync(new URL('../supabase/migrations/202610280003_personal_admin_initial_password.sql', import.meta.url), 'utf8');
  const customerRoute = readFileSync(new URL('../app/api/personal-admin/customers/route.ts', import.meta.url), 'utf8');
  const gate = readFileSync(new URL('../src/components/auth/AuthGate.tsx', import.meta.url), 'utf8');
  const completeRoute = readFileSync(new URL('../app/api/auth/complete-initial-password/route.ts', import.meta.url), 'utf8');
  const newCustomer = readFileSync(new URL('../src/components/personal-admin/NewCustomer.tsx', import.meta.url), 'utf8');
  assert.match(migration, /create table if not exists public\.customer_initial_password_requirements/);
  assert.match(migration, /create_personal_admin_customer_account/);
  assert.match(migration, /customer_personal_admin_assignments/);
  assert.match(migration, /personal_admin_customer_created/);
  assert.match(migration, /email_verification.*administratively_confirmed_not_proof_of_ownership/);
  assert.match(migration, /complete_customer_initial_password_change/);
  assert.match(migration, /grant execute.*create_personal_admin_customer_account.*service_role/s);
  assert.match(customerRoute, /createUser/);
  assert.match(customerRoute, /email_confirm: true/);
  assert.doesNotMatch(customerRoute, /inviteUserByEmail/);
  assert.match(customerRoute, /deleteUser\(customerId\)/);
  assert.match(gate, /\/auth\/change-initial-password/);
  assert.match(gate, /initialPasswordRequired/);
  assert.match(completeRoute, /updateUserById\(user\.id, \{ password \}\)/);
  assert.match(completeRoute, /complete_customer_initial_password_change/);
  assert.match(newCustomer, /Initial password/);
});

test('Super Admin permission editor includes an explicit financial-adjustment control', () => {
  const page = readFileSync(new URL('../app/admin/personal-admins/page.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../app/api/admin/personal-admins/route.ts', import.meta.url), 'utf8');
  assert.match(page, /"manage_financial_adjustments"/);
  assert.match(page, /defaultChecked=\{permissions\[permission\] === true\}/);
  assert.match(route, /manage_financial_adjustments: incoming\.manage_financial_adjustments === true/);
  assert.match(route, /isSuperAdmin\(user\)/);
});

test('Personal Admin registrations activate atomically and remain fully auditable to Super Admin', () => {
  const registrationRoute = readFileSync(new URL('../app/api/personal-admin/route.ts', import.meta.url), 'utf8');
  const adminRoute = readFileSync(new URL('../app/api/admin/personal-admins/route.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../supabase/migrations/202610280001_automatic_personal_admin_activation.sql', import.meta.url), 'utf8');
  const managementPage = readFileSync(new URL('../app/admin/personal-admins/page.tsx', import.meta.url), 'utf8');
  const statuses = load('src/lib/personalAdminStatus.ts', {});
  assert.match(registrationRoute, /rpc\("register_active_personal_admin_profile"/);
  assert.match(registrationRoute, /p_user_id: user\.id/);
  assert.match(adminRoute, /Only suspension or rejection can be set manually/);
  assert.doesNotMatch(adminRoute, /approve_personal_admin_profile/);
  assert.match(managementPage, /active automatically/);
  assert.match(managementPage, /Audit activity/);
  assert.doesNotMatch(managementPage, /Approve once/);
  assert.match(migration, /alter column status set default 'approved'/);
  assert.match(migration, /register_active_personal_admin_profile/);
  assert.match(migration, /personal_admin_auto_approved/);
  assert.match(migration, /where status = 'pending_approval'/);
  assert.match(migration, /update public\.personal_admin_profiles/);
  assert.match(migration, /insert into public\.personal_admin_audit_log/);
  assert.equal(statuses.personalAdminStatusLabel('pending_approval'), 'Pending approval');
  assert.doesNotMatch(statuses.personalAdminStatusMessage('pending_approval'), /pending_approval/);
});

test('shared sign out clears only account session state and returns every role to the public homepage', () => {
  const signOut = readFileSync(new URL('../src/components/auth/SignOutButton.tsx', import.meta.url), 'utf8');
  const sessionCache = readFileSync(new URL('../src/lib/sessionLogout.ts', import.meta.url), 'utf8');
  const personalAdminPortal = readFileSync(new URL('../src/components/personal-admin/PersonalAdminPortal.tsx', import.meta.url), 'utf8');
  const desktopSidebar = readFileSync(new URL('../src/components/layout/DesktopSidebar.tsx', import.meta.url), 'utf8');
  const bottomNav = readFileSync(new URL('../src/components/navigation/BottomNav.tsx', import.meta.url), 'utf8');
  assert.match(signOut, /supabase\.auth\.signOut\(\)/);
  assert.match(signOut, /action: "clear"/);
  assert.match(signOut, /if \(!sessionClear\.ok\)/);
  assert.match(signOut, /window\.location\.replace\("\/"\)/);
  assert.match(signOut, /disabled=\{busy\}/);
  assert.match(signOut, /role="alert"/);
  assert.match(sessionCache, /clearCachedAdminStatus\(\)/);
  assert.match(sessionCache, /aurexbank-kyc-/);
  assert.match(sessionCache, /aurex-bill-pay/);
  assert.match(sessionCache, /aurexbank:transfer-verification-requests/);
  assert.doesNotMatch(sessionCache, /localStorage\.clear\(\)/);
  for (const source of [personalAdminPortal, desktopSidebar, bottomNav]) {
    assert.match(source, /SignOutButton/);
  }
});

test('Personal Admin lifecycle controls remain tenant scoped, auditable, and reachable from customer operations', () => {
  const migration = readFileSync(new URL('../supabase/migrations/202610280004_personal_admin_customer_lifecycle.sql', import.meta.url), 'utf8');
  const customerRoute = readFileSync(new URL('../app/api/personal-admin/customers/[customerId]/route.ts', import.meta.url), 'utf8');
  const avatarRoute = readFileSync(new URL('../app/api/personal-admin/customers/[customerId]/avatar/route.ts', import.meta.url), 'utf8');
  const manager = readFileSync(new URL('../src/components/personal-admin/CustomerManager.tsx', import.meta.url), 'utf8');
  const portal = readFileSync(new URL('../src/components/personal-admin/PersonalAdminPortal.tsx', import.meta.url), 'utf8');
  assert.match(migration, /personal_admin_customer_activity/);
  assert.match(migration, /update_personal_admin_customer_lifecycle/);
  assert.match(migration, /Customer is outside this Personal Admin portfolio/);
  assert.match(migration, /personal_admin_customer_lifecycle_updated/);
  assert.match(customerRoute, /approvedPersonalAdmin/);
  assert.match(customerRoute, /\.eq\("personal_admin_id", user\.id\)/);
  assert.match(customerRoute, /update_personal_admin_customer_lifecycle/);
  assert.match(avatarRoute, /Customer is outside your portfolio/);
  assert.match(avatarRoute, /MAX_FILE_SIZE/);
  assert.match(avatarRoute, /personal_admin_customer_avatar_updated/);
  assert.match(manager, /Save customer changes/);
  assert.match(manager, /Upload photo/);
  assert.match(manager, /\/auth\/forgot-password/);
  assert.match(portal, /\/personal-admin\/customers\/\$\{customer\.id\}/);
});
