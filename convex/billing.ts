import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import { requireUserId } from './lib';
import { PRO_ENTITLEMENT } from './proPolicy';

export const save = internalMutation({
  args: { owner: v.string(), active: v.boolean(), expiresAt: v.union(v.number(), v.null()), checkedAt: v.number(), productId: v.optional(v.string()), environment: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await ctx.db.query('accountDeletions').withIndex('by_owner', q => q.eq('owner', args.owner)).unique()) return null;
    const old = await ctx.db.query('subscriptions').withIndex('by_owner', q => q.eq('owner', args.owner)).unique();
    if (old && old.checkedAt > args.checkedAt) return null;
    if (old) await ctx.db.patch(old._id, args);
    else await ctx.db.insert('subscriptions', args);
    return null;
  },
});
export const eventSeen = internalMutation({
  args: { eventId: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => !!await ctx.db.query('subscriptionEvents').withIndex('by_event', q => q.eq('eventId', args.eventId)).unique(),
});
export const markEvent = internalMutation({
  args: { eventId: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const old = await ctx.db.query('subscriptionEvents').withIndex('by_event', q => q.eq('eventId', args.eventId)).unique();
    if (!old) await ctx.db.insert('subscriptionEvents', { ...args, receivedAt: Date.now() });
    return null;
  },
});

type Subscriber = {
  entitlements?: Record<string, { expires_date: string | null; product_identifier: string; grace_period_expires_date?: string | null }>;
  subscriptions?: Record<string, { is_sandbox?: boolean; store?: string; grace_period_expires_date?: string | null }>;
};
export function subscriptionAccess(subscriber: Subscriber, production: boolean, now: number, allowAppStoreSandbox = false) {
  const entitlement = subscriber.entitlements?.[PRO_ENTITLEMENT];
  const product = entitlement && subscriber.subscriptions?.[entitlement.product_identifier];
  // TestFlight uses verified Apple sandbox receipts. Enable these explicitly
  // during the public beta; Test Store and unknown stores never qualify.
  const appleSandbox = allowAppStoreSandbox && product?.store === 'app_store' && product.is_sandbox === true;
  const blocked = production && (!product || !['app_store', 'play_store'].includes(product.store ?? '') ||
    (product.is_sandbox !== false && !appleSandbox));
  const expiry = entitlement?.expires_date ? Date.parse(entitlement.expires_date) : null;
  const grace = Date.parse(entitlement?.grace_period_expires_date ?? product?.grace_period_expires_date ?? '');
  const expiresAt = expiry === null ? null : Math.max(expiry, Number.isFinite(grace) ? grace : 0);
  return { active: !!entitlement && !blocked && (expiresAt === null || (Number.isFinite(expiresAt) && expiresAt > now)),
    expiresAt: expiresAt !== null && !Number.isFinite(expiresAt) ? 0 : expiresAt,
    productId: entitlement?.product_identifier };
}
export async function reconcile(ctx: ActionCtx, owner: string) {
  if (await ctx.runQuery(internal.account.isDeleting, { owner })) return false;
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) throw new Error('billing_unavailable');
  const checkedAt = Date.now();
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(owner)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('billing_unavailable');
  const body = await response.json() as { subscriber: Subscriber };
  if (!body.subscriber || typeof body.subscriber !== 'object') throw new Error('billing_unavailable');
  // Fail closed unless this deployment is explicitly designated development.
  const production = process.env.BILLING_ENVIRONMENT !== 'development';
  const access = subscriptionAccess(body.subscriber, production, checkedAt, process.env.ALLOW_APP_STORE_SANDBOX === 'true');
  await ctx.runMutation(internal.billing.save, { owner, ...access, checkedAt, environment: production ? 'production' : 'development' });
  return access.active;
}
export async function refreshCaller(ctx: ActionCtx, force = false) {
  const owner = await requireUserId(ctx);
  const old = await ctx.runQuery(internal.pro.subscription, {});
  if (force || !old || Date.now() - old.checkedAt > 300_000) await reconcile(ctx, owner);
}
