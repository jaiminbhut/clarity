/// <reference types="bun" />
import { mock } from 'bun:test';
import { convexTest } from 'convex-test';
import { createElement, useLayoutEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import schema from '../convex/schema';
import { api, internal } from '../convex/_generated/api';
import { subscriptionAccess } from '../convex/billing';
import { readBoundedBody, readSessionKey } from '../convex/requestBody';
import { assertProductionEnvironment } from '../lib/release-config';

let passed = 0;
function check(value: unknown, label: string): asserts value { if (!value) throw new Error(label); passed++; }
async function rejects(fn: () => unknown, expected: string) {
  try { await fn(); } catch (error) { check(String(error).includes(expected), `${expected}: ${error}`); return; }
  throw new Error(`Expected rejection: ${expected}`);
}
const modules = {
  '../convex/_generated/server.js': () => import('../convex/_generated/server'),
  '../convex/pro.ts': () => import('../convex/pro'),
  '../convex/billing.ts': () => import('../convex/billing'),
  '../convex/supplements.ts': () => import('../convex/supplements'),
  '../convex/account.ts': () => import('../convex/account'),
  '../convex/costs.ts': () => import('../convex/costs'),
  '../convex/http.ts': () => import('../convex/http'),
  '../convex/sessions.ts': () => import('../convex/sessions'),
  '../convex/settings.ts': () => import('../convex/settings'),
  '../convex/passages.ts': () => import('../convex/passages'),
};
const t = convexTest(schema, modules);
const alice = t.withIdentity({ subject: 'user_alice' });
const bob = t.withIdentity({ subject: 'user_bob' });
for (const path of ['speech-assessment', 'speech-coach', 'practice-passage', 'pronounce', 'pro/status', 'pro/preview', 'pro/preview-release', 'pro/assessment-done']) {
  check((await t.fetch(`/api/${path}`, { method: 'POST', body: '{}' })).status === 401, `Anonymous ${path} denied`);
}
for (const query of [api.pro.status, api.settings.get, api.passages.list]) await rejects(() => t.query(query, {}), 'Not authenticated');
await rejects(() => t.query(api.sessions.since, { after: 0, limit: 25 }), 'Not authenticated');
await rejects(() => t.mutation(api.settings.push, { patch: {}, stamps: {} }), 'Not authenticated');
await rejects(() => t.mutation(api.passages.push, { passages: [] }), 'Not authenticated');
await rejects(() => t.mutation(api.sessions.push, { records: [] }), 'Not authenticated');
await rejects(() => t.mutation(api.account.deleteAll, {}), 'Not authenticated');
await alice.mutation(api.settings.push, { patch: { displayName: 'Alice private' }, stamps: { displayName: 1 } });
check(await bob.query(api.settings.get, {}) === null, 'Settings isolated by authenticated owner');
const passage = { clientId: 'same-id', title: 'Alice private', text: 'Private passage', targetWpm: 120, duration: '1 min', artwork: { base: [], blob: [] }, createdAt: 1 };
await alice.mutation(api.passages.push, { passages: [passage] });
check((await bob.query(api.passages.list, {})).length === 0, 'Passages isolated');
await bob.mutation(api.passages.remove, { clientIds: ['same-id'], at: 2 });
check((await alice.query(api.passages.list, {}))[0].deletedAt === undefined, 'Another account cannot delete a passage');
await bob.mutation(api.passages.push, { passages: [{ ...passage, title: 'Bob private' }] });
check((await alice.query(api.passages.list, {}))[0].title === 'Alice private', 'Same client ID cannot overwrite another owner');
const grantId = await alice.mutation(api.pro.beginPreview, { sessionKey: 'preview' });
const args = { key: 'coach:a', fingerprint: 'a', sessionKey: 'preview', feature: 'coach' as const, durationMs: 1000, grantId };
await rejects(() => bob.mutation(internal.pro.reserve, args), 'upgrade_required');
const op = await alice.mutation(internal.pro.reserve, args);
await bob.mutation(internal.pro.finish, { id: op.id, attempt: 1, success: true, result: 'stolen' });
check((await t.run(ctx => ctx.db.get(op.id)))?.status === 'running', 'Another identity cannot finish an operation');
await alice.mutation(internal.pro.finish, { id: op.id, attempt: 1, success: true, result: '{"summary":"private"}' });
check((await bob.query(api.supplements.feedback, { cursor: null })).page.length === 0, 'Saved reports isolated');
await alice.mutation(api.account.deleteAll, {});
await rejects(() => alice.mutation(api.pro.beginPreview, { sessionKey: 'reset-welcome' }), 'account_deleting');
await rejects(() => alice.mutation(api.passages.push, { passages: [passage] }), 'account_deleting');
await rejects(() => alice.mutation(api.settings.push, { patch: {}, stamps: {} }), 'account_deleting');
await rejects(() => alice.mutation(api.sessions.push, { records: [] }), 'account_deleting');
await alice.mutation(internal.billing.save, { owner: 'user_alice', active: true, expiresAt: null, checkedAt: Date.now(), environment: 'production' });
check((await t.run(ctx => ctx.db.query('subscriptions').collect())).length === 0, 'Delayed billing cannot recreate deleted account');
check((await alice.mutation(api.account.deleteAll, {})).done, 'Deletion remains retryable');
check((await bob.query(api.passages.list, {}))[0].title === 'Bob private', 'Deletion preserves other accounts');

const realNow = Date.now;
let clock = Date.UTC(2026, 8, 1);
Date.now = () => clock;
try {
  const db = convexTest(schema, modules); const user = db.withIdentity({ subject: 'user_lease' });
  const grant = await user.mutation(api.pro.beginPreview, { sessionKey: 'deadline' });
  clock += 30 * 60_000 - 1;
  await user.mutation(internal.pro.reserve, { ...args, key: 'deadline', sessionKey: 'deadline', grantId: grant });
  clock += 2;
  check((await user.query(api.pro.status, {})).remaining === 2, 'In-flight output retains preview beyond original deadline');
  const pro = db.withIdentity({ subject: 'user_retry' });
  await pro.mutation(internal.billing.save, { owner: 'user_retry', active: true, expiresAt: null, checkedAt: clock, environment: 'development' });
  const rows: { key: string; fingerprint: string; sessionKey: string; feature: 'assessment'; durationMs: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const row = { key: `retry-${i}`, fingerprint: `${i}`, sessionKey: 'retry', feature: 'assessment' as const, durationMs: 1000 };
    const first = await pro.mutation(internal.pro.reserve, row);
    await pro.mutation(internal.pro.finish, { id: first.id, attempt: first.attempt, success: false });
    rows.push(row);
  }
  clock += 120_001;
  for (const row of rows) await pro.mutation(internal.pro.reserve, row);
  await rejects(() => pro.mutation(internal.pro.reserve, { ...rows[0], key: 'fourth' }), 'processing');
} finally { Date.now = realNow; }

const receipt = (store: string, sandbox: boolean) => ({ entitlements: { 'Clarity Pro': { expires_date: new Date(Date.now() + 86400000).toISOString(), product_identifier: 'annual' } }, subscriptions: { annual: { store, is_sandbox: sandbox } } });
check(subscriptionAccess(receipt('app_store', true), true, Date.now(), true).active, 'Explicit public-beta flag accepts verified Apple sandbox');
check(!subscriptionAccess(receipt('app_store', true), true, Date.now()).active, 'Apple sandbox fails closed outside beta');
for (const store of ['test_store', 'unknown', 'promotional', 'play_store']) check(!subscriptionAccess(receipt(store, true), true, Date.now(), true).active, `${store} cannot use Apple beta exception`);
const oldEnv = { ...process.env };
const oldFetch = globalThis.fetch;
process.env.BILLING_ENVIRONMENT = 'production'; process.env.ALLOW_APP_STORE_SANDBOX = 'true';
process.env.REVENUECAT_WEBHOOK_AUTH = 'qa-auth'; process.env.REVENUECAT_SECRET_API_KEY = 'qa-key'; process.env.REVENUE_NET_SHARE = '0.85';
globalThis.fetch = (async (_input: string | URL | Request) => Response.json({ subscriber: receipt('app_store', true) })) as typeof fetch;
try {
  const deliver = (store: string) => t.fetch('/revenuecat', { method: 'POST', headers: { Authorization: 'qa-auth' }, body: JSON.stringify({ event: { id: store, type: 'INITIAL_PURCHASE', store, environment: 'SANDBOX', app_user_id: 'user_bob', price: 79.99, transaction_id: 'sandbox', purchased_at_ms: Date.now(), expiration_at_ms: Date.now() + 86400000 } }) });
  await deliver('TEST_STORE');
  check(!(await bob.query(api.pro.status, {})).isPro, 'Test Store webhook remains blocked in beta');
  check((await deliver('APP_STORE')).status === 200 && (await bob.query(api.pro.status, {})).isPro, 'Apple sandbox webhook reconciles beta entitlement');
  check((await t.run(ctx => ctx.db.query('subscriptionRevenue').collect())).length === 0, 'Sandbox purchases never count as revenue');
} finally {
  globalThis.fetch = oldFetch;
  for (const key of ['BILLING_ENVIRONMENT', 'ALLOW_APP_STORE_SANDBOX', 'REVENUECAT_WEBHOOK_AUTH', 'REVENUECAT_SECRET_API_KEY', 'REVENUE_NET_SHARE']) {
    if (oldEnv[key] === undefined) delete process.env[key]; else process.env[key] = oldEnv[key];
  }
}
const request = (body: string) => new Request('https://example.test', { method: 'POST', body });
await rejects(() => readBoundedBody(request('x'.repeat(513)), 512), 'invalid_request');
await rejects(() => readSessionKey(request('null')), 'invalid_request');
await rejects(() => readSessionKey(request('{')), 'invalid_request');
check(await readSessionKey(request('{"sessionKey":"valid"}')) === 'valid', 'Bounded valid request accepted');
const release = { APP_VARIANT: 'production', EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_example', EXPO_PUBLIC_RC_IOS_API_KEY: 'appl_example', EXPO_PUBLIC_CONVEX_URL: 'https://enduring-kangaroo-904.convex.cloud' };
assertProductionEnvironment(release); passed++;
for (const key of ['EXPO_PUBLIC_MOCK_PRACTICE', 'EXPO_PUBLIC_AUTOMATION', 'EXPO_PUBLIC_SEED_HOOKS', 'EXPO_PUBLIC_DEV_SIGNIN_PASSWORD', 'EXPO_PUBLIC_AZURE_SPEECH_KEY']) await rejects(() => assertProductionEnvironment({ ...release, [key]: '1' }), 'Unsafe production');
await rejects(() => assertProductionEnvironment({ ...release, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example' }), 'live Clerk');
// Exercise the actual transitive query-string parser with the advisory's
// malformed-byte shape. A transport deep link must not block the JS thread.
const queryString = require('query-string');
const started = performance.now();
check(queryString.parse('value=' + '%C0'.repeat(3000)).value.length === 9000, 'Malformed query preserved without recursive decoder');
check(performance.now() - started < 1000, 'Malformed deep link decodes within a bounded interval');
check(queryString.parse('value=hello+world').value === 'hello world', 'CommonJS query-string plus contract preserved');

// Render the actual boundary and prove cleanup happens before another user's
// children mount; no source-text assertion or simulated component substitute.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let owner: string | null = 'user_old';
let auth: { isLoaded: boolean; isSignedIn: boolean; userId: string | null } = { isLoaded: true, isSignedIn: true, userId: owner };
let privateData = ['old private record'];
const events: string[] = [];
mock.module('@clerk/expo', () => ({ useAuth: () => auth }));
mock.module('@/services/auth-state', () => ({ getLastSignedInUserId: () => owner, setLastSignedInUserId: (next: string | null) => { owner = next; } }));
mock.module('@/services/account', () => ({ clearAccountData: () => { events.push('clear'); owner = null; privateData = []; } }));
mock.module('@/services/purchases', () => ({ forgetPurchaser: async () => null }));
const { AccountBoundary } = await import('../components/account-boundary');
function Consumer() {
  useLayoutEffect(() => { events.push(`mount:${owner}:${privateData.length}`); return () => { events.push('unmount'); }; }, []);
  return createElement('span', {}, privateData.join(','));
}
const element = () => createElement(AccountBoundary, { children: createElement(Consumer) });
let renderer!: ReactTestRenderer;
await act(async () => { renderer = create(element()); });
auth = { isLoaded: true, isSignedIn: false, userId: null };
await act(async () => renderer.update(element()));
check(events.indexOf('unmount') < events.indexOf('clear'), 'Revocation unmounts consumers before clearing');
check(privateData.length === 0 && owner === null, 'Remote revocation removes local account data');
auth = { isLoaded: true, isSignedIn: true, userId: 'user_new' };
await act(async () => renderer.update(element()));
check(events.includes('mount:user_new:0'), 'New account mounts with no previous private data');
privateData = ['new account private'];
auth = { isLoaded: true, isSignedIn: true, userId: 'user_third' };
await act(async () => renderer.update(element()));
check(events.includes('mount:user_third:0'), 'Direct account switching clears before mounting');
await act(async () => renderer.unmount());
console.log(`${passed} security regression checks passed`);
