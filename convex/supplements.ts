import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireUserId } from './lib';

import { assessmentInput } from './assessmentSchema';
export const save = mutation({
  args: { sessionId: v.string(), sessionKey: v.string(), payload: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await requireUserId(ctx);
    if (args.sessionId.length > 128 || args.sessionKey.length > 128 || args.payload.length > 400_000) throw new Error('Invalid assessment');
    assessmentInput.parse(JSON.parse(args.payload));
    const operations = await ctx.db.query('premiumOperations').withIndex('by_owner_session', q => q.eq('owner', owner).eq('sessionKey', args.sessionKey)).collect();
    if (!operations.some(o => o.feature === 'assessment' && o.status === 'success')) throw new Error('Assessment not completed');
    const existing = await ctx.db.query('assessmentSupplements').withIndex('by_owner_session', q => q.eq('owner', owner).eq('sessionId', args.sessionId)).unique();
    // One final grade per attempt. Transport retries cannot rewrite it.
    if (!existing) await ctx.db.insert('assessmentSupplements', { owner, sessionId: args.sessionId, payload: args.payload, updatedAt: Date.now() });
    return null;
  },
});
export const page = query({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ page: v.array(v.object({ sessionId: v.string(), payload: v.string() })), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, { cursor }) => {
    const owner = await requireUserId(ctx);
    const result = await ctx.db.query('assessmentSupplements').withIndex('by_owner_updated', q => q.eq('owner', owner)).order('asc').paginate({ cursor, numItems: 25 });
    return { isDone: result.isDone, continueCursor: result.continueCursor, page: result.page.map(row => ({ sessionId: row.sessionId, payload: row.payload })) };
  },
});
export const feedback = query({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ page: v.array(v.object({ key: v.string(), result: v.string() })), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, { cursor }) => {
    const owner = await requireUserId(ctx);
    const rows = await ctx.db.query('premiumOperations').withIndex('by_owner_completed', q => q.eq('owner', owner).gt('completedAt', 0)).order('asc').paginate({ cursor, numItems: 25 });
    return { isDone: rows.isDone, continueCursor: rows.continueCursor, page: rows.page.flatMap(row => row.feature === 'coach' && row.status === 'success' && row.result ? [{ key: row.key, result: row.result }] : []) };
  },
});
