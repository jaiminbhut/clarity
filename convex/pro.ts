import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { requireUserId } from './lib';
import { feature } from './proTables';
import { activePro, monthWindow, MONTHLY_PREVIEWS, OPERATION_LEASE_MS, PREVIEW_LEASE_MS, PREVIEW_MS, previewInUse } from './proPolicy';

const deny = (code: string) => { throw new ConvexError(code); };
export const status = query({
  args: {},
  returns: v.object({ isPro: v.boolean(), expiresAt: v.union(v.number(), v.null()), checkedAt: v.number(), remaining: v.number(), resetsAt: v.number() }),
  handler: async (ctx) => {
    const owner = await requireUserId(ctx);
    const now = Date.now();
    const { month, resetsAt } = monthWindow(now);
    const sub = await ctx.db.query('subscriptions').withIndex('by_owner', q => q.eq('owner', owner)).unique();
    const monthly = await ctx.db.query('previewGrants').withIndex('by_owner_month', q => q.eq('owner', owner).eq('month', month)).collect();
    const welcome = await ctx.db.query('previewGrants').withIndex('by_owner_month', q => q.eq('owner', owner).eq('month', 'welcome')).collect();
    return { isPro: activePro(sub, now), expiresAt: sub?.expiresAt ?? null, checkedAt: sub?.checkedAt ?? 0,
      remaining: Math.max(0, MONTHLY_PREVIEWS - monthly.filter(g => previewInUse(g, now)).length) +
        (welcome.some(g => previewInUse(g, now)) ? 0 : 1), resetsAt };
  },
});
export const beginPreview = mutation({
  args: { sessionKey: v.string() }, returns: v.id('previewGrants'),
  handler: async (ctx, { sessionKey }) => {
    const owner = await requireUserId(ctx);
    if (!sessionKey || sessionKey.length > 128) return deny('invalid_request');
    const now = Date.now();
    const existing = await ctx.db.query('previewGrants').withIndex('by_owner_session', q => q.eq('owner', owner).eq('sessionKey', sessionKey)).unique();
    if (existing) {
      if (existing.committed || existing.leaseUntil > now) return existing._id;
      return deny('preview_expired');
    }
    const welcome = await ctx.db.query('previewGrants').withIndex('by_owner_month', q => q.eq('owner', owner).eq('month', 'welcome')).collect();
    const useWelcome = !welcome.some(g => previewInUse(g, now));
    const { month } = monthWindow(now);
    if (!useWelcome) {
      const monthly = await ctx.db.query('previewGrants').withIndex('by_owner_month', q => q.eq('owner', owner).eq('month', month)).collect();
      if (monthly.filter(g => previewInUse(g, now)).length >= MONTHLY_PREVIEWS) return deny('preview_exhausted');
    }
    return ctx.db.insert('previewGrants', { owner, sessionKey, month: useWelcome ? 'welcome' : month,
      welcome: useWelcome, committed: false, leaseUntil: now + PREVIEW_LEASE_MS });
  },
});
export const subscription = internalQuery({
  args: {}, returns: v.union(v.object({ active: v.boolean(), expiresAt: v.union(v.number(), v.null()), checkedAt: v.number() }), v.null()),
  handler: async (ctx) => {
    const owner = await requireUserId(ctx);
    const sub = await ctx.db.query('subscriptions').withIndex('by_owner', q => q.eq('owner', owner)).unique();
    return sub ? { active: sub.active, expiresAt: sub.expiresAt, checkedAt: sub.checkedAt } : null;
  },
});
export const releasePreview = mutation({
  args: { sessionKey: v.string() }, returns: v.null(),
  handler: async (ctx, { sessionKey }) => {
    const owner = await requireUserId(ctx);
    const grant = await ctx.db.query('previewGrants').withIndex('by_owner_session', q => q.eq('owner', owner).eq('sessionKey', sessionKey)).unique();
    if (!grant || grant.committed) return null;
    const operations = await ctx.db.query('premiumOperations').withIndex('by_grant', q => q.eq('grantId', grant._id)).collect();
    // An in-flight provider response may still commit this grant. Never make
    // its slot available to another device until that work has settled.
    if (operations.some(o => o.status === 'running' && o.leaseUntil > Date.now())) return null;
    await ctx.db.patch(grant._id, { leaseUntil: 0 });
    return null;
  },
});
export const reserve = internalMutation({
  args: { key: v.string(), fingerprint: v.string(), sessionKey: v.string(), feature, grantId: v.optional(v.id('previewGrants')), durationMs: v.number() },
  returns: v.object({ id: v.id('premiumOperations'), attempt: v.number(), result: v.optional(v.string()), audioId: v.optional(v.id('_storage')), cached: v.boolean() }),
  handler: async (ctx, args) => {
    const owner = await requireUserId(ctx);
    const now = Date.now();
    const previous = await ctx.db.query('premiumOperations').withIndex('by_owner_key', q => q.eq('owner', owner).eq('key', args.key)).unique();
    if (previous && previous.fingerprint !== args.fingerprint) return deny('operation_conflict');
    if (previous?.status === 'success') return { id: previous._id, attempt: previous.attempts, result: previous.result, audioId: previous.audioId, cached: true };
    if (previous?.status === 'running' && previous.leaseUntil > now) return deny('processing');
    const sub = await ctx.db.query('subscriptions').withIndex('by_owner', q => q.eq('owner', owner)).unique();
    const isPro = activePro(sub, now);
    if (!isPro) {
      if (!args.grantId) return deny('upgrade_required');
      const grant = await ctx.db.get(args.grantId);
      if (!grant || grant.owner !== owner || grant.sessionKey !== args.sessionKey) return deny('upgrade_required');
      if (!grant.committed && grant.leaseUntil <= now) return deny('preview_expired');
      const operations = await ctx.db.query('premiumOperations').withIndex('by_grant', q => q.eq('grantId', grant._id)).collect();
      const used = operations.filter(o => o._id !== previous?._id && o.feature === args.feature &&
        (o.status === 'success' || (o.status === 'running' && o.leaseUntil > now)));
      if (args.feature === 'assessment') {
        if (args.durationMs + used.reduce((sum, o) => sum + o.durationMs, 0) > PREVIEW_MS) return deny('preview_exhausted');
      } else if (used.length >= (args.feature === 'pronunciation' ? 5 : 1)) return deny('preview_exhausted');
      if (args.feature === 'coach' && args.durationMs > PREVIEW_MS) return deny('preview_exhausted');
      // A job started near the reservation deadline still owns its slot until
      // it settles. Otherwise another device can reserve the same welcome slot.
      if (!grant.committed) await ctx.db.patch(grant._id, { leaseUntil: Math.max(grant.leaseUntil, now + OPERATION_LEASE_MS) });
    }
    // A burst constraint, not a subscription allowance. Finished work is never counted here.
    const recent = await ctx.db.query('premiumOperations').withIndex('by_owner', q => q.eq('owner', owner).gt('_creationTime', now - OPERATION_LEASE_MS)).collect();
    // Retries keep their original creation time, so a creation-time window
    // alone misses old operations that are actively running again.
    const active = await ctx.db.query('premiumOperations').withIndex('by_owner_lease', q => q.eq('owner', owner).gt('leaseUntil', now)).collect();
    const running = active.filter(o => o._id !== previous?._id && o.status === 'running');
    if (args.feature === 'assessment') {
      const job = await ctx.db.query('assessmentJobs').withIndex('by_owner', q => q.eq('owner', owner)).unique();
      if (job && job.leaseUntil > now && job.sessionKey !== args.sessionKey) return deny('processing');
      if (job) await ctx.db.patch(job._id, { sessionKey: args.sessionKey, leaseUntil: now + OPERATION_LEASE_MS });
      else await ctx.db.insert('assessmentJobs', { owner, sessionKey: args.sessionKey, leaseUntil: now + OPERATION_LEASE_MS });
      const speech = running.filter(o => o.feature === 'assessment');
      if (speech.some(o => o.sessionKey !== args.sessionKey) || speech.length >= 3) return deny('processing');
    } else if (running.filter(o => o.feature === args.feature).length >= 2) return deny('temporarily_throttled');
    if (recent.length > 120) return deny('temporarily_throttled');
    const attempt = (previous?.attempts ?? 0) + 1;
    const row = { ...args, owner, status: 'running' as const, leaseUntil: now + OPERATION_LEASE_MS,
      attempts: attempt, tier: isPro ? 'pro' as const : 'free' as const };
    const id = previous ? previous._id : await ctx.db.insert('premiumOperations', row);
    if (previous) await ctx.db.patch(id, row);
    return { id, attempt, cached: false };
  },
});
export const finish = internalMutation({
  args: { id: v.id('premiumOperations'), attempt: v.number(), success: v.boolean(), result: v.optional(v.string()), audioId: v.optional(v.id('_storage')),
    inputTokens: v.optional(v.number()), outputTokens: v.optional(v.number()), characters: v.optional(v.number()), estimatedCost: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireUserId(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.owner !== owner || row.attempts !== args.attempt || row.status !== 'running') return null;
    const { id, attempt: _attempt, success, ...values } = args;
    if (values.result && values.result.length > 800_000) return deny('invalid_result');
    await ctx.db.patch(id, { ...values, status: success ? 'success' : 'failed', leaseUntil: 0, completedAt: Date.now() });
    if (success && row.grantId) {
      const grant = await ctx.db.get(row.grantId);
      if (grant) await ctx.db.patch(grant._id, { committed: true });
    }
    return null;
  },
});
export const cachedAudio = internalQuery({
  args: { key: v.string() }, returns: v.union(v.id('_storage'), v.null()),
  handler: async (ctx, { key }) => (await ctx.db.query('pronunciationCache').withIndex('by_key', q => q.eq('key', key)).unique())?.audioId ?? null,
});
export const cacheAudio = internalMutation({
  args: { key: v.string(), audioId: v.id('_storage') }, returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('pronunciationCache').withIndex('by_key', q => q.eq('key', args.key)).unique();
    if (!existing) await ctx.db.insert('pronunciationCache', args);
    return null;
  },
});

export const releaseAssessment = mutation({
  args: { sessionKey: v.string() }, returns: v.null(),
  handler: async (ctx, { sessionKey }) => {
    const owner = await requireUserId(ctx);
    const job = await ctx.db.query('assessmentJobs').withIndex('by_owner', q => q.eq('owner', owner)).unique();
    if (job?.sessionKey === sessionKey) await ctx.db.delete(job._id);
    return null;
  },
});
