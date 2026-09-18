import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);

function load(file, mocks, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => name in mocks ? mocks[name] : require(name), ...globals });
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
