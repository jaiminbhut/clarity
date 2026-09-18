import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
export function earnedRevenue(netUsd: number, start: number, end: number, from: number, to: number) {
  if (end <= start) return 0;
  return netUsd * Math.max(0, Math.min(end, to) - Math.max(start, from)) / (end - start);
}
export const recordRevenue = internalMutation({
  args: { owner: v.string(), transactionId: v.string(), start: v.number(), end: v.number(), netUsd: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const old = await ctx.db.query('subscriptionRevenue').withIndex('by_transaction', q => q.eq('transactionId', args.transactionId)).unique();
    if (old) {
      if (args.netUsd < 0) await ctx.db.patch(old._id, { netUsd: 0 });
    } else await ctx.db.insert('subscriptionRevenue', { ...args, netUsd: Math.max(0, args.netUsd) });
    return null;
  },
});
export const page = internalQuery({
  args: { kind: v.union(v.literal('cost'), v.literal('revenue')), from: v.number(), to: v.number(), cursor: v.union(v.string(), v.null()) },
  returns: v.object({ value: v.number(), unpriced: v.number(), done: v.boolean(), cursor: v.string() }),
  handler: async (ctx, args) => {
    if (args.kind === 'cost') {
      const result = await ctx.db.query('premiumOperations').withIndex('by_completed', q => q.gte('completedAt', args.from).lt('completedAt', args.to)).paginate({ cursor: args.cursor, numItems: 100 });
      return { value: result.page.reduce((sum, row) => sum + (row.estimatedCost ?? 0), 0),
        unpriced: result.page.filter(row => row.estimatedCost === undefined).length, done: result.isDone, cursor: result.continueCursor };
    }
    const result = await ctx.db.query('subscriptionRevenue').withIndex('by_end', q => q.gt('end', args.from)).paginate({ cursor: args.cursor, numItems: 100 });
    return { value: result.page.reduce((sum, row) => sum + earnedRevenue(row.netUsd, row.start, row.end, args.from, args.to), 0),
      unpriced: 0, done: result.isDone, cursor: result.continueCursor };
  },
});
export const saveAlert = internalMutation({
  args: { day: v.string(), cost: v.number(), earnedNetRevenue: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const old = await ctx.db.query('costAlerts').withIndex('by_day', q => q.eq('day', args.day)).unique();
    if (old) await ctx.db.patch(old._id, args);
    else await ctx.db.insert('costAlerts', { ...args, createdAt: Date.now() });
    console.warn(JSON.stringify({ event: 'pro.cost_alert', ...args }));
    return null;
  },
});
export const review = internalAction({
  args: {}, returns: v.null(),
  handler: async (ctx) => {
    const to = Date.now();
    const from = to - 7 * 86_400_000;
    const totals = { cost: 0, revenue: 0, unpriced: 0 };
    for (const kind of ['cost', 'revenue'] as const) {
      let cursor: string | null = null;
      for (;;) {
        const result: { value: number; unpriced: number; done: boolean; cursor: string } = await ctx.runQuery(internal.costs.page, { kind, from, to, cursor });
        totals[kind] += result.value;
        totals.unpriced += result.unpriced;
        if (result.done) break;
        cursor = result.cursor;
      }
    }
    console.info(JSON.stringify({ event: 'pro.cost_review', ...totals, from, to }));
    if (totals.unpriced) console.warn(JSON.stringify({ event: 'pro.cost_rates_missing', operations: totals.unpriced }));
    if (totals.cost > totals.revenue * 0.5) await ctx.runMutation(internal.costs.saveAlert, { day: new Date(to).toISOString().slice(0, 10), cost: totals.cost, earnedNetRevenue: totals.revenue });
    return null;
  },
});
