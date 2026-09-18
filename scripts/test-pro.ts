import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import { api, internal } from '../convex/_generated/api';
import { monthWindow, wavDuration } from '../convex/proPolicy';
import { subscriptionAccess } from '../convex/billing';
import { earnedRevenue } from '../convex/costs';
import { createHistoryStore, createMemoryKv, type RecordSessionInput } from '../lib/history-store';

const modules = {
  '../convex/_generated/server.js': () => import('../convex/_generated/server'),
  '../convex/pro.ts': () => import('../convex/pro'),
  '../convex/billing.ts': () => import('../convex/billing'),
  '../convex/supplements.ts': () => import('../convex/supplements'),
  '../convex/account.ts': () => import('../convex/account'),
  '../convex/costs.ts': () => import('../convex/costs'),
  '../convex/http.ts': () => import('../convex/http'),
};
let passed = 0;
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); passed++; }
async function rejects(action: () => Promise<unknown>, code: string) {
  try { await action(); } catch (e) { assert(String(e).includes(code), `Expected ${code}: ${e}`); return; }
  throw new Error(`Expected rejection ${code}`);
}
const now = Date.UTC(2026, 8, 8);
assert(monthWindow(Date.UTC(2026, 11, 31)).resetsAt === Date.UTC(2027, 0, 1), 'UTC year rollover');
const subscriber = (product: string, expiry: number | null, sandbox = false, grace?: number) => ({
  entitlements: { 'Clarity Pro': { expires_date: expiry === null ? null : new Date(expiry).toISOString(), product_identifier: product } },
  subscriptions: { [product]: { is_sandbox: sandbox, store: 'app_store', grace_period_expires_date: grace ? new Date(grace).toISOString() : undefined } },
});
for (const product of ['clarity_pro_weekly', 'clarity_pro_monthly', 'clarity_pro_yearly']) {
  assert(subscriptionAccess(subscriber(product, now + 1000), true, now).active, `${product} entitled`);
  assert(!subscriptionAccess(subscriber(product, now - 1000), true, now).active, `${product} expired`);
  assert(!subscriptionAccess(subscriber(product, now + 1000, true), true, now).active, `${product} sandbox rejected in prod`);
  assert(subscriptionAccess(subscriber(product, now - 1000, false, now + 1000), true, now).active, `${product} grace retained`);
}
assert(!subscriptionAccess({}, true, now).active, 'No receipt does not grant access');
assert(!subscriptionAccess({ entitlements: subscriber('test', null).entitlements, subscriptions: { test: { store: 'test_store', is_sandbox: false } } }, true, now).active, 'Test Store cannot grant production even with a false sandbox flag');
assert(earnedRevenue(84, 0, 365, 0, 7) === 84 * 7 / 365, 'Annual revenue recognized over service period');
const wav = new Uint8Array(44 + 32000); const view = new DataView(wav.buffer);
const tag = (o: number, text: string) => wav.set(new TextEncoder().encode(text), o);
tag(0, 'RIFF'); tag(8, 'WAVE'); tag(12, 'fmt '); view.setUint32(16, 16, true);
view.setUint32(4, wav.length - 8, true);
view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, 32000, true);
assert(wavDuration(wav) === 1000, 'Duration comes from validated PCM bytes');
try { wavDuration(wav, true); throw new Error('accepted silence'); } catch (e) { assert(String(e).includes('Silent WAV'), 'Digital silence rejected before provider request'); }
view.setInt16(44, 1, true);
assert(wavDuration(wav, true) === 1000, 'Quiet audio is not rejected by an amplitude threshold');
view.setUint32(24, 8000, true);
try { wavDuration(wav); throw new Error('accepted invalid WAV'); } catch (e) { assert(String(e).includes('Unsupported WAV'), 'Reject unsupported format'); }

{
  const t = convexTest(schema, modules);
  const user = t.withIdentity({ subject: 'user_free' });
  await rejects(() => t.query(api.pro.status, {}), 'Not authenticated');
  assert((await user.query(api.supplements.page, { cursor: null })).isDone, 'Empty saved assessment page validates');
  assert((await user.query(api.supplements.feedback, { cursor: null })).isDone, 'Empty saved coaching page validates');
  const original = await user.query(api.pro.status, {});
  assert(original.remaining === 3 && !original.isPro, 'One welcome plus two monthly previews');
  const concurrent = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => user.mutation(api.pro.beginPreview, { sessionKey: `session-${i}` })));
  assert(concurrent.filter(r => r.status === 'fulfilled').length === 3, 'Concurrent devices cannot overbook previews');
  const first = concurrent[0]; assert(first.status === 'fulfilled', 'First reservation succeeds');
  const grantId = first.value;
  assert(await user.mutation(api.pro.beginPreview, { sessionKey: 'session-0' }) === grantId, 'Preview reservation idempotent');
  const base = { key: 'coach:one', fingerprint: 'body', sessionKey: 'session-0', feature: 'coach' as const, grantId, durationMs: 90000 };
  const reservation = await user.mutation(internal.pro.reserve, base);
  await rejects(() => user.mutation(internal.pro.reserve, base), 'processing');
  await rejects(() => t.withIdentity({ subject: 'user_other' }).mutation(internal.pro.reserve, base), 'upgrade_required');
  await user.mutation(internal.pro.finish, { id: reservation.id, attempt: reservation.attempt, success: false });
  const retry = await user.mutation(internal.pro.reserve, base);
  assert(retry.attempt === 2, 'Failed operation can retry');
  await user.mutation(internal.pro.finish, { id: retry.id, attempt: retry.attempt, success: true, result: '{"summary":"saved"}', estimatedCost: 0.001 });
  const cached = await user.mutation(internal.pro.reserve, base);
  assert(cached.cached && cached.result?.includes('saved'), 'Successful response is reused');
  await rejects(() => user.mutation(internal.pro.reserve, { ...base, key: 'coach:two' }), 'preview_exhausted');
  await rejects(() => user.mutation(internal.pro.reserve, { ...base, fingerprint: 'changed' }), 'operation_conflict');
  for (let i = 0; i < 5; i++) {
    const audio = await user.mutation(internal.pro.reserve, { ...base, key: `audio:${i}`, feature: 'pronunciation', durationMs: 0 });
    await user.mutation(internal.pro.finish, { id: audio.id, attempt: audio.attempt, success: true, result: 'clip' });
  }
  await rejects(() => user.mutation(internal.pro.reserve, { ...base, key: 'audio:6', feature: 'pronunciation', durationMs: 0 }), 'preview_exhausted');
  for (let i = 0; i < 3; i++) {
    const audio = await user.mutation(internal.pro.reserve, { ...base, key: `speech:${i}`, feature: 'assessment', durationMs: 28000 });
    await user.mutation(internal.pro.finish, { id: audio.id, attempt: audio.attempt, success: true, result: 'grade' });
  }
  await rejects(() => user.mutation(internal.pro.reserve, { ...base, key: 'speech:4', feature: 'assessment', durationMs: 28000 }), 'preview_exhausted');
  // Move reservations to an earlier month: monthly slots reset, welcome remains spent.
  await t.run(async ctx => { for (const row of await ctx.db.query('previewGrants').collect()) if (!row.welcome) await ctx.db.patch(row._id, { month: '2020-01', committed: true }); });
  assert((await user.query(api.pro.status, {})).remaining === 2, 'Monthly reset never restores welcome');
  await user.mutation(api.account.deleteAll, {});
  assert((await t.run(ctx => ctx.db.query('premiumOperations').collect())).length === 0, 'Account deletion clears processing and reports');
}
{
  const realNow = Date.now;
  let clock = now;
  Date.now = () => clock;
  try {
    for (const productId of ['clarity_pro_weekly', 'clarity_pro_monthly', 'clarity_pro_yearly']) {
      const t = convexTest(schema, modules); const user = t.withIdentity({ subject: 'user_pro' });
      await user.mutation(internal.billing.save, { owner: 'user_pro', active: true, expiresAt: now + 366 * 86400000, checkedAt: now, environment: 'production', productId });
      for (let i = 0; i < 260; i++) {
        clock += 5000;
        const op = await user.mutation(internal.pro.reserve, { key: `assessment:${i}`, fingerprint: `${i}`, sessionKey: 'long-session', feature: 'assessment', durationMs: 28000 });
        await user.mutation(internal.pro.finish, { id: op.id, attempt: op.attempt, success: true, result: 'grade' });
      }
      assert((await user.query(api.pro.status, {})).isPro, `${productId} remains unlimited past 120 minutes`);
      await rejects(() => user.mutation(internal.pro.reserve, { key: 'other-device', fingerprint: 'x', sessionKey: 'other-session', feature: 'assessment', durationMs: 28000 }), 'processing');
      await user.mutation(api.pro.releaseAssessment, { sessionKey: 'long-session' });
      const other = await user.mutation(internal.pro.reserve, { key: 'other-device', fingerprint: 'x', sessionKey: 'other-session', feature: 'assessment', durationMs: 28000 });
      assert(!!other.id, 'Queued account job can proceed after release');
    }
  } finally { Date.now = realNow; }
}
{
  const t = convexTest(schema, modules);
  const response = await t.fetch('/api/speech-coach', { method: 'POST', body: '{}' });
  assert(response.status === 401, 'Unauthenticated direct HTTP cannot invoke provider');
  const webhook = await t.fetch('/revenuecat', { method: 'POST', body: '{}' });
  assert(webhook.status === 401, 'Unauthenticated webhook cannot grant Pro');
}
{
  const t = convexTest(schema, modules);
  const user = t.withIdentity({ subject: 'user_abandoned' });
  const grantId = await user.mutation(api.pro.beginPreview, { sessionKey: 'abandoned' });
  await t.withIdentity({ subject: 'user_other' }).mutation(api.pro.releasePreview, { sessionKey: 'abandoned' });
  assert((await user.query(api.pro.status, {})).remaining === 2, 'Another account cannot release a preview');
  const op = await user.mutation(internal.pro.reserve, { key: 'running', fingerprint: 'x', sessionKey: 'abandoned', feature: 'coach', durationMs: 1000, grantId });
  await user.mutation(api.pro.releasePreview, { sessionKey: 'abandoned' });
  assert((await user.query(api.pro.status, {})).remaining === 2, 'Running processing keeps its reservation');
  await user.mutation(internal.pro.finish, { id: op.id, attempt: op.attempt, success: false });
  await user.mutation(api.pro.releasePreview, { sessionKey: 'abandoned' });
  assert((await user.query(api.pro.status, {})).remaining === 3, 'Abandoned unsuccessful preview is immediately reusable');
  await rejects(() => user.mutation(api.pro.beginPreview, { sessionKey: 'abandoned' }), 'preview_expired');
  await user.mutation(internal.billing.save, { owner: 'user_abandoned', active: false, expiresAt: now, checkedAt: now + 2, environment: 'development' });
  await user.mutation(internal.billing.save, { owner: 'user_abandoned', active: true, expiresAt: now + 99999999999, checkedAt: now + 1, environment: 'development' });
  assert(!(await user.query(api.pro.status, {})).isPro, 'Older reconciliation cannot reinstate a refunded or transferred entitlement');
  const previous = process.env.BILLING_ENVIRONMENT;
  const previousSecret = process.env.REVENUECAT_WEBHOOK_AUTH;
  process.env.BILLING_ENVIRONMENT = 'production'; process.env.REVENUECAT_WEBHOOK_AUTH = 'test-secret';
  try {
    const response = await t.fetch('/revenuecat', { method: 'POST', headers: { Authorization: 'test-secret' }, body: JSON.stringify({ event: { id: 'test-store', environment: 'PRODUCTION', store: 'TEST_STORE', app_user_id: 'user_abandoned' } }) });
    assert(response.status === 200 && !(await user.query(api.pro.status, {})).isPro, 'Production acknowledges Test Store webhooks without granting access');
  } finally {
    if (previous === undefined) delete process.env.BILLING_ENVIRONMENT; else process.env.BILLING_ENVIRONMENT = previous;
    if (previousSecret === undefined) delete process.env.REVENUECAT_WEBHOOK_AUTH; else process.env.REVENUECAT_WEBHOOK_AUTH = previousSecret;
  }
}
{
  const t = convexTest(schema, modules);
  const from = t.withIdentity({ subject: 'user_transfer_from' });
  const to = t.withIdentity({ subject: 'user_transfer_to' });
  const realFetch = globalThis.fetch;
  const savedEnvironment = { BILLING_ENVIRONMENT: process.env.BILLING_ENVIRONMENT, REVENUECAT_WEBHOOK_AUTH: process.env.REVENUECAT_WEBHOOK_AUTH, REVENUECAT_SECRET_API_KEY: process.env.REVENUECAT_SECRET_API_KEY };
  let refunded = false; let reads = 0;
  process.env.BILLING_ENVIRONMENT = 'production'; process.env.REVENUECAT_WEBHOOK_AUTH = 'webhook-test'; process.env.REVENUECAT_SECRET_API_KEY = 'server-test';
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (!String(url).startsWith('https://api.revenuecat.com/v1/subscribers/')) throw new Error('Unexpected network call in billing test');
    reads++;
    return Response.json({ subscriber: !refunded && String(url).endsWith('user_transfer_to') ? subscriber('clarity_pro_monthly', Date.now() + 86400000) : {} });
  }) as typeof fetch;
  try {
    const deliver = (event: Record<string, unknown>) => t.fetch('/revenuecat', { method: 'POST', headers: { Authorization: 'webhook-test' }, body: JSON.stringify({ event: { environment: 'PRODUCTION', store: 'APP_STORE', ...event } }) });
    await from.mutation(internal.billing.save, { owner: 'user_transfer_from', active: true, expiresAt: Date.now() + 86400000, checkedAt: now, environment: 'production' });
    const transfer = { id: 'transfer-1', type: 'TRANSFER', transferred_from: ['user_transfer_from'], transferred_to: ['user_transfer_to'] };
    assert((await deliver(transfer)).status === 200, 'Authenticated transfer webhook succeeds');
    assert(!(await from.query(api.pro.status, {})).isPro && (await to.query(api.pro.status, {})).isPro, 'Transfer reconciles both accounts against RevenueCat');
    const firstReads = reads;
    await deliver(transfer);
    assert(reads === firstReads, 'Repeated webhook delivery does not repeat reconciliation');
    refunded = true;
    await deliver({ id: 'refund-1', type: 'CANCELLATION', app_user_id: 'user_transfer_to' });
    assert(!(await to.query(api.pro.status, {})).isPro, 'Refund follows current authoritative subscription state');
    await deliver({ id: 'delayed-renewal', type: 'RENEWAL', app_user_id: 'user_transfer_to' });
    assert(!(await to.query(api.pro.status, {})).isPro, 'Delayed renewal cannot reverse the current refund');
    await to.mutation(internal.costs.recordRevenue, { owner: 'user_transfer_to', transactionId: 'refund-before-purchase', start: now, end: now + 86400000, netUsd: -7 });
    await to.mutation(internal.costs.recordRevenue, { owner: 'user_transfer_to', transactionId: 'refund-before-purchase', start: now, end: now + 86400000, netUsd: 7 });
    assert((await t.run(ctx => ctx.db.query('subscriptionRevenue').collect()))[0].netUsd === 0, 'Out-of-order refund cannot turn back into earned revenue');
  } finally {
    globalThis.fetch = realFetch;
    for (const [key, value] of Object.entries(savedEnvironment)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
{
  const kv = createMemoryKv(); let clock = now;
  const store = createHistoryStore({ kv, now: () => clock });
  const input: RecordSessionInput = { mode: 'passage', endedReason: 'completed', durationMs: 30000, accuracy: 60, fluency: 60,
    completeness: 60, intonation: 60, paceWpm: 120, targetWpm: 120, fillerCount: 0, spokenWords: 20, source: 'live',
    wordCounts: { good: 1, mispronounced: 0, omitted: 0, inserted: 0 }, challengingWords: [], words: [{ word: 'clarity', status: 'good' }] };
  const first = store.recordSession(input); assert(first.ok, 'Base session saved'); clock += 30000;
  store.recordSession(input);
  const update = { ...input, source: 'azure' as const, accuracy: 92, words: [{ word: 'clarity', status: 'mispronounced' }], wordCounts: { good: 0, mispronounced: 1, omitted: 0, inserted: 0 } };
  assert(store.applyAssessment(first.record.id, update), 'Supplement applied');
  assert(store.getRecords().length === 2 && store.getRecords()[0].durationMs === 30000, 'No duplicate session or duration');
  assert(store.getBaseRecords()[0].accuracy === 60 && store.getRecords()[0].accuracy === 92, 'Immutable sync base and effective grade separated');
  const words = store.getWordStats()[0];
  assert(words.seen === 2 && words.clean === 1 && words.mispronounced === 1 && words.cleanStreak === 1, 'Replacement replays later verdicts correctly');
  store.applyAssessment(first.record.id, update);
  assert(store.getWordStats()[0].seen === 2, 'Repeated supplement never double counts');
  const reopened = createHistoryStore({ kv });
  assert(reopened.getRecords()[0].accuracy === 92 && reopened.getWordStats()[0].seen === 2, 'Supplement survives restart');
  let failNextWord = true;
  const faulty = { ...kv, set(key: string, value: string | number | boolean) {
    if (key.startsWith('w/') && failNextWord) { failNextWord = false; throw new Error('Disk unavailable'); }
    kv.set(key, value);
  } };
  const interrupted = createHistoryStore({ kv: faulty });
  assert(!interrupted.applyAssessment(first.record.id, { ...input, accuracy: 95 }), 'Failed word replacement reports failure');
  const recovered = createHistoryStore({ kv });
  assert(recovered.getRecords()[0].accuracy === 92 && recovered.getWordStats()[0].mispronounced === 1, 'Failed replacement restores both grade and word contribution');
  store.clearAccountData();
  assert(!kv.getAllKeys().some(key => key.startsWith('assessment/')), 'Account clear removes grade journals');
}
console.log(`${passed} premium checks passed`);
