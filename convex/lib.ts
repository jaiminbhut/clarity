import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server';
import { ConvexError } from 'convex/values';
import { internal } from './_generated/api';

/**
 * The one place the caller's identity is read. Every function starts here and
 * none takes a userId argument, so a row can only ever be written under the
 * subject Clerk signed for.
 *
 * `identity.subject` is the Clerk user id, the same value the app's auth bridge
 * keeps in MMKV as the synchronous sign-in flag.
 */
export async function requireUserId(ctx: QueryCtx | MutationCtx | ActionCtx, options: { allowDeleting?: boolean } = {}): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new Error('Not authenticated');
  // Read-only subscriptions may drain during deletion without throwing through
  // React's query boundary and unmounting the Settings retry flow. Writes and
  // provider actions are blocked, including already-issued Clerk tokens.
  const readOnly = 'db' in ctx && !('insert' in ctx.db);
  if (!options.allowDeleting && !readOnly) {
    const deleting = 'db' in ctx
      ? !!await ctx.db.query('accountDeletions').withIndex('by_owner', q => q.eq('owner', identity.subject)).unique()
      : await ctx.runQuery(internal.account.isDeleting, { owner: identity.subject });
    if (deleting) throw new ConvexError('account_deleting');
  }
  return identity.subject;
}
