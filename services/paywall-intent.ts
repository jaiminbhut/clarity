import { router } from 'expo-router';
import { getLastSignedInUserId } from '@/services/auth-state';
import { newOperationId, type PremiumFeature } from '@/services/pro-access';
import { proEvent } from '@/services/observe-events';

type Intent = { id: string; owner: string | null; feature: PremiumFeature; resolve: (unlocked: boolean) => void };
let pending: Intent | null = null;
export function openFeaturePaywall(feature: PremiumFeature): Promise<boolean> {
  if (pending) return Promise.resolve(false);
  return new Promise(resolve => {
    pending = { id: newOperationId(), owner: getLastSignedInUserId(), feature, resolve };
    proEvent('feature_tapped', { feature });
    router.push({ pathname: '/paywall', params: { intentId: pending.id, source: feature } });
  });
}
export function settlePaywall(id: string | undefined, unlocked: boolean) {
  if (!pending || pending.id !== id) return;
  const intent = pending;
  pending = null;
  // Navigation gets to close the modal before the original action resumes.
  setTimeout(() => intent.resolve(unlocked && intent.owner === getLastSignedInUserId()), 0);
}
