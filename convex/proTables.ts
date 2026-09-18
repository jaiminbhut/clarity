import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const feature = v.union(v.literal('assessment'), v.literal('coach'), v.literal('exercise'), v.literal('pronunciation'));
export const proTables = {
  accountDeletions: defineTable({ owner: v.string(), startedAt: v.number() }).index('by_owner', ['owner']),
  assessmentJobs: defineTable({ owner: v.string(), sessionKey: v.string(), leaseUntil: v.number() }).index('by_owner', ['owner']),
  subscriptionRevenue: defineTable({ owner: v.string(), transactionId: v.string(), start: v.number(), end: v.number(), netUsd: v.number() }).index('by_transaction', ['transactionId']).index('by_end', ['end']).index('by_owner', ['owner']),
  subscriptions: defineTable({
    owner: v.string(), active: v.boolean(), expiresAt: v.union(v.number(), v.null()),
    checkedAt: v.number(), productId: v.optional(v.string()), environment: v.string(),
  }).index('by_owner', ['owner']),
  subscriptionEvents: defineTable({ eventId: v.string(), receivedAt: v.number() }).index('by_event', ['eventId']),
  previewGrants: defineTable({
    owner: v.string(), sessionKey: v.string(), month: v.string(), welcome: v.boolean(),
    committed: v.boolean(), leaseUntil: v.number(),
  }).index('by_owner_month', ['owner', 'month']).index('by_owner_session', ['owner', 'sessionKey']).index('by_owner', ['owner']),
  premiumOperations: defineTable({
    owner: v.string(), key: v.string(), fingerprint: v.string(), sessionKey: v.string(), feature,
    grantId: v.optional(v.id('previewGrants')), status: v.union(v.literal('running'), v.literal('success'), v.literal('failed')),
    leaseUntil: v.number(), durationMs: v.number(), result: v.optional(v.string()),
    audioId: v.optional(v.id('_storage')), inputTokens: v.optional(v.number()), outputTokens: v.optional(v.number()),
    characters: v.optional(v.number()), estimatedCost: v.optional(v.number()), attempts: v.number(),
    tier: v.union(v.literal('free'), v.literal('pro')), completedAt: v.optional(v.number()),
  }).index('by_owner_key', ['owner', 'key']).index('by_owner', ['owner']).index('by_owner_lease', ['owner', 'leaseUntil'])
    .index('by_grant', ['grantId']).index('by_owner_session', ['owner', 'sessionKey'])
    .index('by_completed', ['completedAt']).index('by_owner_completed', ['owner', 'completedAt']),
  pronunciationCache: defineTable({ key: v.string(), audioId: v.id('_storage') }).index('by_key', ['key']),
  assessmentSupplements: defineTable({ owner: v.string(), sessionId: v.string(), payload: v.string(), updatedAt: v.number() })
    .index('by_owner_session', ['owner', 'sessionId']).index('by_owner_updated', ['owner', 'updatedAt']),
  costAlerts: defineTable({ day: v.string(), cost: v.number(), earnedNetRevenue: v.number(), createdAt: v.number() }).index('by_day', ['day']),
};
