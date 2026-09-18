import { v } from 'convex/values';

import { internalQuery, mutation } from './_generated/server';
import { requireUserId } from './lib';

/** Bounded so one call cannot exceed a mutation's read/write limits. The client
 * loops until `done`. */
const BATCH = 200;

export const isDeleting = internalQuery({
  args: { owner: v.string() }, returns: v.boolean(),
  handler: async (ctx, { owner }) => !!await ctx.db.query('accountDeletions').withIndex('by_owner', q => q.eq('owner', owner)).unique(),
});

/**
 * Account deletion, required by App Store guideline 5.1.1(v). The app calls
 * this BEFORE deleting the Clerk user: once the user is gone there is no
 * identity left that could delete these rows.
 */
export const deleteAll = mutation({
  args: {},
  returns: v.object({ deleted: v.number(), done: v.boolean() }),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx, { allowDeleting: true });
    // Retain only an opaque account-id tombstone. Other devices, unexpired
    // JWTs and delayed billing webhooks cannot repopulate a deleted account or
    // reset its welcome allowance. Repeated deletion calls remain available.
    const deletion = await ctx.db.query('accountDeletions').withIndex('by_owner', q => q.eq('owner', userId)).unique();
    if (!deletion) await ctx.db.insert('accountDeletions', { owner: userId, startedAt: Date.now() });
    let budget = BATCH;
    let deleted = 0;

    const premiumQueries = [
      () => ctx.db.query('subscriptions').withIndex('by_owner', q => q.eq('owner', userId)).take(budget),
      () => ctx.db.query('previewGrants').withIndex('by_owner', q => q.eq('owner', userId)).take(budget),
      () => ctx.db.query('premiumOperations').withIndex('by_owner', q => q.eq('owner', userId)).take(budget),
      () => ctx.db.query('assessmentSupplements').withIndex('by_owner_updated', q => q.eq('owner', userId)).take(budget),
      () => ctx.db.query('assessmentJobs').withIndex('by_owner', q => q.eq('owner', userId)).take(budget),
      () => ctx.db.query('subscriptionRevenue').withIndex('by_owner', q => q.eq('owner', userId)).take(budget),
    ];
    for (const read of premiumQueries) {
      if (budget <= 0) break;
      const rows = await read();
      for (const row of rows) await ctx.db.delete(row._id);
      deleted += rows.length;
      budget -= rows.length;
    }
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .take(budget);
    for (const row of sessions) await ctx.db.delete(row._id);
    deleted += sessions.length;
    budget -= sessions.length;

    if (budget > 0) {
      const passages = await ctx.db
        .query('passages')
        .withIndex('by_user_created', (q) => q.eq('userId', userId))
        .take(budget);
      for (const row of passages) await ctx.db.delete(row._id);
      deleted += passages.length;
      budget -= passages.length;
    }

    if (budget > 0) {
      const settings = await ctx.db
        .query('settings')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique();
      if (settings !== null) {
        await ctx.db.delete(settings._id);
        deleted += 1;
      }
    }

    // A full batch means there may be more; the client calls again.
    return { deleted, done: deleted < BATCH };
  },
});
