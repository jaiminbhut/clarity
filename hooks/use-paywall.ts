/** All upgrade requests use the custom paywall; RevenueCat owns Customer Center. */
import { useCallback } from 'react';
import { router } from 'expo-router';
import { Observe } from 'expo-observe';
import RevenueCatUI from 'react-native-purchases-ui';
import { useSubscription } from '@/hooks/use-subscription';
import { describePurchasesError } from '@/services/purchases';
import { openFeaturePaywall } from '@/services/paywall-intent';
import { getProStatus, refreshProAccess, type PremiumFeature } from '@/services/pro-access';

export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'notPresented' | 'error';
export function usePaywall() {
  const { available, refresh } = useSubscription();
  const presentPaywall = useCallback(async (): Promise<PaywallOutcome> => {
    if (!available) return 'error';
    router.push('/paywall');
    return 'notPresented';
  }, [available]);
  const requirePro = useCallback(async (action: () => void | Promise<void>, feature: PremiumFeature = 'coach'): Promise<boolean> => {
    let access = getProStatus();
    try { access = await refreshProAccess(); } catch { /* Cached entitlement only supports local/offline views; server rechecks every provider request. */ }
    if (access.isPro && (access.expiresAt === null || access.expiresAt > Date.now())) {
      await action();
      return true;
    }
    if (!available) { router.push('/paywall'); return false; }
    if (!await openFeaturePaywall(feature)) return false;
    const verified = await refreshProAccess();
    if (!verified.isPro) return false;
    await action();
    return true;
  }, [available]);
  /**
   * The self-serve subscription screen: cancel, change plan, request a refund
   * (iOS), report a missing purchase. Configured under Project Settings >
   * Customer Center in the dashboard.
   *
   * `refresh` runs on the callbacks that can change entitlement state, since a
   * cancellation or refund happens on the store's side.
   */
  const presentCustomerCenter = useCallback(async () => {
    if (!available) return;
    try {
      await RevenueCatUI.presentCustomerCenter({
        callbacks: {
          onRestoreCompleted: () => {
            refresh();
          },
          onRefundRequestCompleted: () => {
            refresh();
          },
          onShowingManageSubscriptions: () => {
            // The customer is leaving for the store's own management page, where
            // they may cancel. Nothing to await, so refresh on the way out.
            refresh();
          },
        },
      });
      await refreshProAccess().catch(() => {});
    } catch (cause) {
      console.warn('[purchases] customer center failed', describePurchasesError(cause), cause);
      // The only route to cancel or request a refund in-app, so a failure here
      // ends in a support email rather than anything we would otherwise see.
      Observe.reportError(cause);
    }
  }, [available, refresh]);

  return { presentPaywall, presentPaywallIfNeeded: presentPaywall, requirePro, presentCustomerCenter };
}
