import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CHROME_BLUR_BLEED, ProgressiveBlur } from '@/components/glass-tabs';
import { GlassSurface } from '@/components/ui';
import { onboarding, radius, spacing, springs } from '@/constants/theme';
import { useMarkInteractive } from '@/hooks/use-mark-interactive';
import { useTheme } from '@/hooks/use-theme';
import { OnboardingHeaderHeightContext } from './header-height-context';
import AccentStep from './pages/accent';
import GoalStep from './pages/goal';
import MicrophoneStep from './pages/microphone';
import NameStep from './pages/name';
import PriorityStep from './pages/priority';
import { ONBOARDING_STEPS } from './steps';

const PAGES = { name: NameStep, accent: AccentStep, goal: GoalStep, priority: PriorityStep, microphone: MicrophoneStep };

export default function OnboardingFlow() {
  useMarkInteractive();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [{ index, furthest }, setPage] = useState({ index: 0, furthest: 0 });
  const current = useRef(0);
  // One continuous position keeps the page translation and progress in sync,
  // including when Back interrupts a forward spring before it has settled.
  const position = useSharedValue(0);

  useLayoutEffect(() => {
    position.value = withSpring(index, { ...springs.onboarding, reduceMotion: ReduceMotion.System });
  }, [index, position]);

  const goTo = useCallback((next: number) => {
    if (next < 0 || next >= ONBOARDING_STEPS.length || next === current.current) return;
    current.current = next;
    Keyboard.dismiss();
    setPage((previous) => ({ index: next, furthest: Math.max(previous.furthest, next) }));
  }, []);

  const back = useCallback(() => {
    if (current.current === 0) return false;
    void Haptics.selectionAsync();
    goTo(current.current - 1);
    return true;
  }, [goTo]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', back);
    return () => subscription.remove();
  }, [back]));

  return (
    <View
      style={[styles.screen, { backgroundColor: colors.background }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <OnboardingHeaderHeightContext
        value={headerHeight || insets.top + spacing.sm + onboarding.backSize + spacing.sm}>
        <View style={styles.viewport}>
          {ONBOARDING_STEPS.map((step, pageIndex) => {
            // Keep visited pages mounted to retain drafts, scroll positions,
            // and the explicit "Not sure yet" choice when returning to them.
            // Future pages stay unmounted so permission checks do not run early.
            if (pageIndex > furthest) return null;
            const Page = PAGES[step];
            const active = pageIndex === index;
            return (
              <PagerPage key={step} index={pageIndex} active={active} position={position} width={width}>
                <Page
                  active={active}
                  onContinue={() => {
                    // A second tap or keyboard submit from the departing page
                    // must not skip the next question.
                    if (current.current === pageIndex) goTo(pageIndex + 1);
                  }}
                />
              </PagerPage>
            );
          })}
        </View>
      </OnboardingHeaderHeightContext>
      <View
        pointerEvents="box-none"
        style={styles.headerOverlay}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}>
        <ProgressiveBlur
          direction="top"
          tint={scheme}
          style={[StyleSheet.absoluteFill, { bottom: -CHROME_BLUR_BLEED }]}
        />
        <View pointerEvents="box-none" style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          {index > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back}>
              <GlassSurface radius="full" interactive style={styles.backCircle}>
                <HugeiconsIcon icon={ArrowLeft01Icon} size={onboarding.iconSize} color={colors.foreground} strokeWidth={onboarding.iconStroke} />
              </GlassSurface>
            </Pressable>
          ) : <View style={styles.spacer} />}
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Setup progress"
            accessibilityValue={{ min: 0, max: ONBOARDING_STEPS.length, now: index + 1, text: `Step ${index + 1} of ${ONBOARDING_STEPS.length}` }}
            style={styles.progressTrack}>
            {ONBOARDING_STEPS.map((step, pageIndex) => (
              <ProgressSegment key={step} index={pageIndex} position={position} />
            ))}
          </View>
          <View style={styles.spacer} />
        </View>
      </View>
    </View>
  );
}

function PagerPage({ index, active, position, width, children }: {
  index: number;
  active: boolean;
  position: SharedValue<number>;
  width: number;
  children: ReactNode;
}) {
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: (index - position.value) * width }],
  }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, slide]}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
      {children}
    </Animated.View>
  );
}

function ProgressSegment({ index, position }: { index: number; position: SharedValue<number> }) {
  const { colors } = useTheme();
  const fill = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, position.value + 1 - index)) * 100}%`,
  }));
  return (
    <View style={[styles.segment, { backgroundColor: colors.track }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: colors.accent }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  viewport: { flex: 1, overflow: 'hidden' },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
    gap: spacing.lg,
    width: '100%',
    maxWidth: onboarding.contentWidth,
    alignSelf: 'center',
  },
  backCircle: {
    width: onboarding.backSize,
    height: onboarding.backSize,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: onboarding.backSize, height: onboarding.backSize },
  progressTrack: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: onboarding.progressHeight, borderRadius: radius.full, overflow: 'hidden' },
  segmentFill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.full },
});
