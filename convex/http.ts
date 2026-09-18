import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api, internal } from './_generated/api';
import { reconcile, refreshCaller } from './billing';
import { errorResponse, processPremium } from './premiumHttp';
import { requireUserId } from './lib';
import { readSessionKey } from './requestBody';

const http = httpRouter();
const paths = { '/api/speech-coach': 'coach', '/api/practice-passage': 'exercise', '/api/pronounce': 'pronunciation', '/api/speech-assessment': 'assessment' } as const;
http.route({ path: '/api/pro/preview-release', method: 'POST', handler: httpAction(async (ctx, request) => {
  try {
    try { await requireUserId(ctx); } catch { throw new Error('authentication_required'); }
    await ctx.runMutation(api.pro.releasePreview, { sessionKey: await readSessionKey(request) });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}) });
for (const [path, feature] of Object.entries(paths)) {
  http.route({ path, method: 'POST', handler: httpAction((ctx, request) => processPremium(ctx, request, feature)) });
}
http.route({ path: '/api/pro/assessment-done', method: 'POST', handler: httpAction(async (ctx, request) => {
  try {
    try { await requireUserId(ctx); } catch { throw new Error('authentication_required'); }
    await ctx.runMutation(api.pro.releaseAssessment, { sessionKey: await readSessionKey(request) });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}) });
http.route({ path: '/api/pro/status', method: 'POST', handler: httpAction(async (ctx) => {
  try {
    try { await requireUserId(ctx); } catch { throw new Error('authentication_required'); }
    await refreshCaller(ctx, true);
    return Response.json(await ctx.runQuery(api.pro.status, {}));
  } catch (error) { return errorResponse(error); }
}) });
http.route({ path: '/api/pro/preview', method: 'POST', handler: httpAction(async (ctx, request) => {
  try {
    try { await requireUserId(ctx); } catch { throw new Error('authentication_required'); }
    return Response.json({ grantId: await ctx.runMutation(api.pro.beginPreview, { sessionKey: await readSessionKey(request) }) });
  } catch (error) { return errorResponse(error); }
}) });
http.route({ path: '/revenuecat', method: 'POST', handler: httpAction(async (ctx, request) => {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!secret || request.headers.get('Authorization') !== secret) return new Response(null, { status: 401 });
  try {
    const body = await request.json();
    const event = body?.event;
    if (!event || typeof event.id !== 'string' || event.id.length > 200) return new Response(null, { status: 400 });
    const appleSandbox = process.env.ALLOW_APP_STORE_SANDBOX === 'true' && event.environment === 'SANDBOX' && event.store === 'APP_STORE';
    if (process.env.BILLING_ENVIRONMENT !== 'development' &&
        (event.store === 'TEST_STORE' || (event.environment !== 'PRODUCTION' && !appleSandbox))) return new Response(null, { status: 200 });
    if (await ctx.runMutation(internal.billing.eventSeen, { eventId: event.id })) return new Response(null, { status: 200 });
    const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? []), ...(event.transferred_from ?? []), ...(event.transferred_to ?? [])];
    const owners = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.startsWith('user_') && id.length <= 128))];
    for (const owner of owners) await reconcile(ctx, owner);
    // Beta purchases are free. Never count simulated receipts as earned revenue.
    if (event.environment === 'PRODUCTION' && event.store !== 'TEST_STORE' && owners[0] && typeof event.price === 'number' && Number.isFinite(event.price) &&
        typeof event.transaction_id === 'string' && typeof event.purchased_at_ms === 'number' && typeof event.expiration_at_ms === 'number' &&
        (['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE'].includes(event.type) || event.price < 0)) {
      const share = Number(process.env.REVENUE_NET_SHARE);
      if (Number.isFinite(share) && share > 0 && share <= 1) await ctx.runMutation(internal.costs.recordRevenue, {
        owner: owners[0], transactionId: event.transaction_id, start: event.purchased_at_ms, end: event.expiration_at_ms, netUsd: event.price * share,
      });
      else console.warn(JSON.stringify({ event: 'pro.revenue_rate_missing' }));
    }
    await ctx.runMutation(internal.billing.markEvent, { eventId: event.id });
    console.info(JSON.stringify({ event: 'subscription.reconciled', type: event.type, accounts: owners.length }));
    return new Response(null, { status: 200 });
  } catch { return new Response(null, { status: 503 }); }
}) });
export default http;
