import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import { router, useSegments } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/ui';
import { CHROME_BLUR_BLEED, ProgressiveBlur } from '@/components/glass-tabs';
import { ONBOARDING_STEPS } from '@/components/onboarding';
import { OnboardingHeaderHeightContext } from '@/components/onboarding/header-height-context';
import { onboarding, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The first step. Set here, inside the group, rather than as a root anchor:
 * the root's guards filter after anchors resolve, and an anchor naming a
 * removed group would point the navigator at a screen that is not there. */
export const unstable_settings = { initialRouteName: 'name' };

export default function OnboardingLayout() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const segments = useSegments();
  const current = segments[segments.length - 1];
  const index = Math.max(0, ONBOARDING_STEPS.indexOf(current as never));
  const canGoBack = index > 0;
  const back = () => {
    Haptics.selectionAsync();
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <OnboardingHeaderHeightContext
        value={headerHeight || insets.top + spacing.sm + onboarding.backSize + spacing.sm}>
        <Stack screenOptions={{ headerShown: false }} />
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
          {canGoBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back}>
              <GlassSurface radius="full" interactive style={styles.backCircle}>
                <HugeiconsIcon icon={ArrowLeft01Icon} size={onboarding.iconSize} color={colors.foreground} strokeWidth={onboarding.iconStroke} />
              </GlassSurface>
            </Pressable>
          ) : (
            <View style={styles.spacer} />
          )}
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Setup progress"
            accessibilityValue={{ min: 0, max: ONBOARDING_STEPS.length, now: index + 1, text: `Step ${index + 1} of ${ONBOARDING_STEPS.length}` }}
            style={styles.progressTrack}>
            {ONBOARDING_STEPS.map((step, position) => (
              <View key={step} style={[styles.segment, { backgroundColor: position <= index ? colors.accent : colors.track }]} />
            ))}
          </View>
          <View style={styles.spacer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
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
  spacer: {
    width: onboarding.backSize,
    height: onboarding.backSize,
  },
  progressTrack: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: onboarding.progressHeight, borderRadius: radius.full },
});
