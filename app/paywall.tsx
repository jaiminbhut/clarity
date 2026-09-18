import { CheckmarkCircle02Icon, Crown02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { getPremiumIdentity, refreshProAccess } from '@/services/pro-access';
import { getIdentifiedPurchaserId } from '@/services/auth-state';
import { settlePaywall } from '@/services/paywall-intent';
import { beginPaywallVisit, newTelemetryId, paywallSource, proEvent } from '@/services/observe-events';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';

import { ModalCloseToolbar } from '@/components/modal-close-toolbar';
import { OptionCard, PrimaryButton, ThemedText } from '@/components/ui';
import { radius, spacing } from '@/constants/theme';
import { useMarkInteractive } from '@/hooks/use-mark-interactive';
import { useSubscription } from '@/hooks/use-subscription';
import { useTheme } from '@/hooks/use-theme';
import { fetchCurrentOffering, purchasePackage } from '@/services/purchases';

/** The Pro crown. Not a palette token: it is an illustrative glyph color, fixed
 * in both schemes, matching the header crown in `header-actions.tsx`. */
const PRO_GOLD = '#FFB000';

/** Apple's standard EULA, which covers auto-renewing subscriptions. */
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://devtownhall.com/speakwell/privacy';

/** Plan cards visible at once: two whole ones plus a slice of the third, so the
 * row reads as scrollable without needing a scrollbar. */
const VISIBLE_PLANS = 2.2;
/** Gap between plan cards, and the snap stride together with the card width. */
const PLAN_GAP = spacing.md;
/** The selection indicator. Fixes the card's top row height so the price blocks
 * line up across cards whether or not one carries a savings badge. */
const INDICATOR_SIZE = 24;

const FEATURES = [
  'Unlimited personal AI coaching',
  'Detailed pronunciation feedback',
  'Practice built around your difficult words',
  'Full progress comparisons',
];

/** Display order and the per-card caption wording, keyed by package type. */
const PLAN_LABELS: Partial<Record<PACKAGE_TYPE, { title: string; caption: string }>> = {
  [PACKAGE_TYPE.ANNUAL]: { title: 'Annual', caption: 'per year' },
  [PACKAGE_TYPE.MONTHLY]: { title: 'Monthly', caption: 'per month' },
  [PACKAGE_TYPE.WEEKLY]: { title: 'Weekly', caption: 'per week' },
};

/** Annual first because it is the default selection and carries the badge. */
function sortPlans(packages: PurchasesPackage[]): PurchasesPackage[] {
  const order = [PACKAGE_TYPE.ANNUAL, PACKAGE_TYPE.MONTHLY, PACKAGE_TYPE.WEEKLY];
  return packages
    .filter((pkg) => order.includes(pkg.packageType))
    .sort((a, b) => order.indexOf(a.packageType) - order.indexOf(b.packageType));
}

/**
 * "Save 44%": the annual price against a year of the monthly plan. Derived from
 * the store's own numbers so it can never disagree with the prices shown; null
 * when either plan is missing or the math yields nothing worth bragging about.
 */
function annualSavings(plans: PurchasesPackage[]): number | null {
  const annual = plans.find((pkg) => pkg.packageType === PACKAGE_TYPE.ANNUAL);
  const monthly = plans.find((pkg) => pkg.packageType === PACKAGE_TYPE.MONTHLY);
  const yearAtMonthlyRate = monthly?.product.pricePerYear ?? null;
  if (!annual || !yearAtMonthlyRate) return null;

  const saved = Math.round((1 - annual.product.price / yearAtMonthlyRate) * 100);
  return saved >= 5 ? saved : null;
}

/**
 * Shown when this build has no store: web, or a release build with no API key.
 * An honest dead end beats a paywall that renders empty, and it names the cause
 * so the next person is not guessing.
 */
function PurchasesUnavailable() {
  const { colors } = useTheme();

  return (
    <View style={styles.centered}>
      <View style={[styles.iconTile, { backgroundColor: colors.card }]}>
        <HugeiconsIcon icon={Crown02Icon} size={32} color={PRO_GOLD} />
      </View>
      <ThemedText variant="title" style={styles.centeredText}>
        SpeakWell Pro is unavailable
      </ThemedText>
      <ThemedText variant="subheadProse" tone="secondary" style={styles.centeredText}>
        This build has no store connected, so plans cannot load. Try the app on a device or
        simulator build.
      </ThemedText>
    </View>
  );
}

/**
 * One plan as a carousel card: the badge and selection indicator on top, the
 * name and price stacked below. The row form this replaced could lean on the
 * full screen width; a card that is a fraction of it has to go vertical.
 */
function PlanCard({
  plan,
  selected,
  savings,
  width,
  onSelect,
}: {
  plan: PurchasesPackage;
  selected: boolean;
  /** "Save 44%" badge value; only the annual card gets one. */
  savings: number | null;
  /** Set by the carousel so a slice of the next card stays in view. */
  width: number;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const labels = PLAN_LABELS[plan.packageType];
  if (!labels) return null;

  const isAnnual = plan.packageType === PACKAGE_TYPE.ANNUAL;
  const perMonth = isAnnual ? plan.product.pricePerMonthString : null;
  const caption = perMonth ? `${perMonth} / mo` : labels.caption;

  return (
    <OptionCard
      selected={selected}
      onSelect={onSelect}
      accessibilityLabel={`${labels.title}, ${plan.product.priceString} ${caption}`}
      style={{ width }}>
      <View style={styles.planBody}>
        <View style={styles.planTopRow}>
          {savings !== null && (
            <View style={[styles.saveBadge, { backgroundColor: colors.accentBg }]}>
              <ThemedText variant="caption" weight="semibold" tone="accent">
                Save {savings}%
              </ThemedText>
            </View>
          )}
          <View style={styles.planIndicator}>
            {selected ? (
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={INDICATOR_SIZE} color={colors.accent} />
            ) : (
              <View style={[styles.radio, { borderColor: colors.track }]} />
            )}
          </View>
        </View>
        <View style={styles.planText}>
          <ThemedText variant="title3">{labels.title}</ThemedText>
          <ThemedText variant="title">{plan.product.priceString}</ThemedText>
          <ThemedText variant="footnote" tone="secondary">
            {caption}
          </ThemedText>
        </View>
      </View>
    </OptionCard>
  );
}

/**
 * The SpeakWell Pro paywall, fully in-app.
 *
 * Layout and copy live here; prices come from the store via the Current
 * offering's packages, so a price change in App Store Connect (or a plan-mix
 * change in the RevenueCat dashboard) still needs no release. Only wording and
 * layout changes do — that is the trade against the previous dashboard-hosted
 * paywall, accepted so the screen can speak the app's own design language.
 *
 * Presented as a modal from the root layout. For gating a locked feature in
 * place, prefer `usePaywall().requirePro` over navigating here.
 */
export default function PaywallScreen() {
  useMarkInteractive();
  const { intentId, source } = useLocalSearchParams<{ intentId?: string; source?: string }>();
  const telemetry = useRef<ReturnType<typeof beginPaywallVisit> | null>(null);
  useEffect(() => {
    const visit = beginPaywallVisit(paywallSource(source));
    telemetry.current = visit;
    return () => {
      visit.close('dismissed');
      settlePaywall(intentId, false);
    };
  }, [intentId, source]);

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { available, isLoading: storeLoading, refresh, restore } = useSubscription();

  // The carousel bleeds past the screen's content padding, so the card width is
  // measured off the full screen rather than the column it aligns to.
  const planWidth = (screenWidth - spacing.lg * 2 - PLAN_GAP * 2) / VISIBLE_PLANS;
  const planStride = planWidth + PLAN_GAP;
  const plansRef = useRef<ScrollView>(null);

  const [plans, setPlans] = useState<PurchasesPackage[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A purchase can land while the customer is also tapping the close button;
  // one latch keeps that from popping two screens.
  const dismissed = useRef(false);
  const close = (unlocked = false) => {
    if (dismissed.current) return;
    dismissed.current = true;
    telemetry.current?.close(unlocked ? 'unlocked' : 'dismissed');
    settlePaywall(intentId, unlocked);
    router.back();
  };

  useEffect(() => {
    if (!available && !storeLoading) telemetry.current?.failed('store_unavailable');
  }, [available, storeLoading, intentId, source]);

  useEffect(() => {
    if (!available) return;
    const visit = telemetry.current;
    let alive = true;
    setLoadFailed(false);
    fetchCurrentOffering()
      .then((offering) => {
        if (!alive) return;
        const sorted = sortPlans(offering?.availablePackages ?? []);
        setPlans(sorted);
        setSelectedId(sorted[0]?.identifier ?? null);
        setLoadFailed(sorted.length === 0);
        if (sorted.length) visit?.ready(sorted.length);
        else visit?.failed('no_plans');
      })
      .catch(() => {
        if (alive) { setLoadFailed(true); visit?.failed('offering_failed'); }
      });
    return () => {
      alive = false;
    };
  }, [available, intentId, source]);

  const selected = plans?.find((plan) => plan.identifier === selectedId) ?? null;
  const savings = plans ? annualSavings(plans) : null;

  // Tapping a card also centres it, so the selection and what the customer is
  // looking at never disagree.
  const selectPlan = (index: number) => {
    const plan = plans?.[index];
    if (!plan) return;
    setSelectedId(plan.identifier);
    plansRef.current?.scrollTo({ x: index * planStride, animated: true });
  };

  // The CTA buys the selected plan, so a card scrolled to must become the
  // selected one — otherwise the button charges for a plan that is off-screen.
  const syncSelectionToScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!plans?.length) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / planStride);
    const plan = plans[Math.min(Math.max(index, 0), plans.length - 1)];
    if (!plan || plan.identifier === selectedId) return;
    Haptics.selectionAsync();
    setSelectedId(plan.identifier);
  };

  const verifyAndClose = async (action: 'purchase' | 'restore', operationId: string, visit: ReturnType<typeof beginPaywallVisit>) => {
    const attributes = { ...visit.attributes, operationId, action };
    const startedAt = performance.now();
    let verified: Awaited<ReturnType<typeof refreshProAccess>>;
    try {
      verified = await refreshProAccess();
    } catch {
      proEvent('verification_resolved', { ...attributes, outcome: 'failed', durationMs: Math.round(performance.now() - startedAt) });
      Alert.alert('Purchase received', 'We could not verify access yet. Your purchase is safe. Check your connection and use Restore purchase.');
      return;
    }
    proEvent('verification_resolved', { ...attributes, outcome: verified.isPro ? 'verified' : 'pending', durationMs: Math.round(performance.now() - startedAt) });
    if (verified.isPro) {
      proEvent('activated', attributes);
      close(true);
    } else Alert.alert('Confirming your purchase', 'Your purchase is processing. Use Restore purchase to check again.');
  };

  const purchaseIdentityReady = (action: 'purchase' | 'restore') => {
    const owner = getPremiumIdentity();
    if (owner && getIdentifiedPurchaserId() === owner) return true;
    if (telemetry.current) proEvent('purchase_blocked', { ...telemetry.current.attributes, action, reason: 'identity_not_ready' });
    Alert.alert('Connecting your account', 'Please wait for your account to connect, then try again.');
    return false;
  };
  const buy = async () => {
    if (!selected || busy || !purchaseIdentityReady('purchase') || !telemetry.current) return;
    const visit = telemetry.current;
    const operationId = newTelemetryId();
    const attributes = { ...visit.attributes, operationId, product: selected.product.identifier };
    const startedAt = performance.now();
    let resolved = false;
    proEvent('purchase_started', attributes);
    setBusy(true);
    try {
      const result = await purchasePackage(selected);
      resolved = true;
      proEvent('purchase_resolved', { ...attributes, outcome: result.outcome, durationMs: Math.round(performance.now() - startedAt) });
      switch (result.outcome) {
        case 'purchased':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await refresh();
          await verifyAndClose('purchase', operationId, visit);
          return;
        case 'pending':
          Alert.alert('Payment pending', 'Your payment is still processing. SpeakWell Pro unlocks as soon as it clears.');
          return;
        case 'failed':
          Alert.alert('Purchase failed', result.message);
          return;
        case 'cancelled':
          return;
      }
    } catch {
      if (!resolved) proEvent('purchase_resolved', { ...attributes, outcome: 'failed', durationMs: Math.round(performance.now() - startedAt) });
      Alert.alert('Purchase could not finish', 'Please try again, or restore your purchase if you already paid.');
    } finally { setBusy(false); }
  };

  const restorePurchase = async () => {
    if (busy || !purchaseIdentityReady('restore') || !telemetry.current) return;
    const visit = telemetry.current;
    const operationId = newTelemetryId();
    const attributes = { ...visit.attributes, operationId };
    const startedAt = performance.now();
    let resolved = false;
    proEvent('restore_started', attributes);
    setBusy(true);
    try {
      const result = await restore();
      resolved = true;
      proEvent('restore_resolved', { ...attributes, outcome: result.outcome, durationMs: Math.round(performance.now() - startedAt) });
      if (result.outcome === 'restored') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await verifyAndClose('restore', operationId, visit);
        return;
      }
      if (result.outcome === 'nothingToRestore') {
        Alert.alert('Nothing to restore', 'We could not find a SpeakWell Pro purchase on this store account. Make sure you are signed in with the account you bought it on.');
        return;
      }
      Alert.alert('Restore failed', result.message);
    } catch {
      if (!resolved) proEvent('restore_resolved', { ...attributes, outcome: 'failed', durationMs: Math.round(performance.now() - startedAt) });
      Alert.alert('Restore could not finish', 'Check your connection and try again.');
    } finally { setBusy(false); }
  };

  if (!available) return <PurchasesUnavailable />;

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <HugeiconsIcon icon={Crown02Icon} size={28} color={PRO_GOLD} />
          <ThemedText variant="title">SpeakWell</ThemedText>
          {isLiquidGlassAvailable() ? (
            <GlassView glassEffectStyle="regular" tintColor={colors.inverseSurface} style={styles.proBadge}>
              <ThemedText variant="callout" tone="inverse">
                Pro
              </ThemedText>
            </GlassView>
          ) : (
            <View style={[styles.proBadge, { backgroundColor: colors.inverseSurface }]}>
              <ThemedText variant="callout" tone="inverse">
                Pro
              </ThemedText>
            </View>
          )}
        </View>

        <ThemedText variant="largeTitle" style={styles.headline}>
          Get personal feedback on every practice
        </ThemedText>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <HugeiconsIcon icon={Tick02Icon} size={20} color={colors.accent} strokeWidth={2} />
              <ThemedText variant="bodyProse" tone="secondary" style={styles.featureText}>
                {feature}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.flexSpacer} />

        {plans === null && !loadFailed ? (
          <View style={styles.plansLoading}>
            <ActivityIndicator color={colors.secondary} />
          </View>
        ) : loadFailed ? (
          <View style={styles.plansLoading}>
            <ThemedText variant="subheadProse" tone="secondary" style={styles.centeredText}>
              Plans could not load. Check your connection and reopen this screen.
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            ref={plansRef}
            horizontal
            accessibilityRole="radiogroup"
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={planStride}
            snapToAlignment="start"
            onMomentumScrollEnd={syncSelectionToScroll}
            // overflow:visible — the cards' interactive glass press response
            // grows past their bounds and a clipping ScrollView shears it off.
            style={styles.plans}
            contentContainerStyle={styles.plansContent}>
            {plans?.map((plan, index) => (
              <PlanCard
                key={plan.identifier}
                plan={plan}
                selected={plan.identifier === selectedId}
                savings={plan.packageType === PACKAGE_TYPE.ANNUAL ? savings : null}
                width={planWidth}
                onSelect={() => selectPlan(index)}
              />
            ))}
          </ScrollView>
        )}

        <Pressable onPress={() => close()} accessibilityRole="button" style={{ padding: spacing.md, alignItems: 'center' }}>
          <ThemedText variant="callout" tone="secondary">Continue free</ThemedText>
        </Pressable>

        <PrimaryButton
          title="Continue with SpeakWell Pro"
          onPress={buy}
          disabled={busy || !selected}
          style={styles.cta}
        />

        <Pressable
          accessibilityRole="button"
          onPress={restorePurchase}
          disabled={busy}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
          <ThemedText variant="subhead" tone="secondary">
            Restore purchase
          </ThemedText>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={spacing.sm}>
            <ThemedText variant="caption" tone="tertiary">
              Terms of Use
            </ThemedText>
          </Pressable>
          <ThemedText variant="caption" tone="dimmed">
            |
          </ThemedText>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={spacing.sm}>
            <ThemedText variant="caption" tone="tertiary">
              Privacy Policy
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
      {/* Same close control as Settings. */}
      <ModalCloseToolbar onPress={() => close()} />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.md,
  },
  centeredText: {
    textAlign: 'center',
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  proBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    textAlign: 'center',
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxxl,
  },
  features: {
    gap: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureText: {
    flex: 1,
  },
  flexSpacer: {
    flexGrow: 1,
    minHeight: spacing.xxxl,
  },
  plans: {
    // Bleeds edge to edge so cards can scroll past the content column, then
    // re-pads its content so the first card still lines up with it.
    marginHorizontal: -spacing.lg,
    overflow: 'visible',
    // ScrollView's own base style is flexGrow:1, so in this column it would
    // eat the spacer's slack and stretch the cards. It must hug its content.
    flexGrow: 0,
  },
  plansContent: {
    paddingHorizontal: spacing.lg,
    gap: PLAN_GAP,
  },
  plansLoading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBody: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: INDICATOR_SIZE,
  },
  planIndicator: {
    marginLeft: 'auto',
  },
  radio: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: radius.full,
    borderWidth: 2,
  },
  planText: {
    gap: spacing.xxs,
  },
  saveBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cta: {
    marginTop: spacing.xxl,
  },
  pressed: {
    opacity: 0.85,
  },
  textButton: {
    alignSelf: 'center',
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
});
