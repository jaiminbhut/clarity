import type { ReactNode } from 'react';
import { use, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, ThemedText } from '@/components/ui';
import { CHROME_BLUR_BLEED, ProgressiveBlur } from '@/components/glass-tabs';
import { onboarding, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { OnboardingHeaderHeightContext } from './header-height-context';

export type OnboardingScreenProps = {
  title: string;
  subtitle?: string;
  /** Center a short question and its input in the space between the chrome. */
  centered?: boolean;
  children: ReactNode;
  ctaTitle: string;
  onContinue: () => void;
  ctaDisabled?: boolean;
  /** Tertiary footnote under the content, for the honest caveats. */
  note?: string | null;
  /** Rendered under the CTA: a "Not now" text button, typically. */
  footer?: ReactNode;
};

/**
 * The shape every onboarding step shares: a scroll view for the question and
 * its choices, and a CTA pinned to the bottom edge. The CTA lives outside the
 * scroll view on a keyboard-driven translate, so on the name step it rides up
 * with the keyboard frame-for-frame instead of hiding behind it. The offset
 * replaces the safe-area padding with the same gap as the horizontal inset.
 *
 * The pager moves this whole page as one unit, without staggered entrances.
 */
export function OnboardingScreen({
  title,
  subtitle,
  centered = false,
  children,
  ctaTitle,
  onContinue,
  ctaDisabled = false,
  note,
  footer,
}: OnboardingScreenProps) {
  const { scheme } = useTheme();
  const headerHeight = use(OnboardingHeaderHeightContext);
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, spacing.lg);
  const [ctaHeight, setCtaHeight] = useState(0);
  // The same math as `KeyboardStickyView` (keyboard height, negative when
  // open, plus the `opened` offset), clamped so the CTA never moves DOWN.
  // Android reports a floating keyboard, a hardware keyboard, or Gboard's
  // stylus toolbar as open with (almost) no height; unclamped, the offset then
  // had nothing to cancel and pushed the button past the screen edge.
  const { height, progress } = useReanimatedKeyboardAnimation();
  const stickyStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: Math.min(
          0,
          height.value + interpolate(progress.value, [0, 1], [0, bottomPad - spacing.xxl]),
        ),
      },
    ],
  }));
  // Resize the centered viewport with the CTA so the question stays centered
  // above it while typing. Long choice screens keep keyboard-aware scrolling.
  const centeredViewportStyle = useAnimatedStyle(() => ({
    marginBottom: centered
      ? -Math.min(0, height.value + interpolate(progress.value, [0, 1], [0, bottomPad - spacing.xxl]))
      : 0,
  }));
  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.screen, centeredViewportStyle]}>
        <KeyboardAwareScrollView
          enabled={!centered}
          bottomOffset={Math.max(0, ctaHeight - bottomPad + spacing.xxl) + CHROME_BLUR_BLEED}
          contentContainerStyle={[
            styles.content,
            centered && styles.centeredContent,
            { paddingTop: headerHeight + (centered ? spacing.xxl : spacing.xxxl), paddingBottom: ctaHeight + spacing.xxl },
          ]}
          scrollIndicatorInsets={{ top: headerHeight, bottom: ctaHeight }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <View style={styles.heading}>
            <ThemedText
              variant={centered ? 'title' : 'largeTitle'}
              style={centered && styles.centeredText}
              accessibilityRole="header">
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText variant="subheadProse" tone="secondary" style={styles.subtitle}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {children}
          {note ? (
            <ThemedText variant="footnoteProse" tone="tertiary" style={styles.note}>
              {note}
            </ThemedText>
          ) : null}
        </KeyboardAwareScrollView>
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[styles.ctaOverlay, stickyStyle]}>
        <ProgressiveBlur
          direction="bottom"
          tint={scheme}
          style={[StyleSheet.absoluteFill, { top: -CHROME_BLUR_BLEED }]}
        />
        <View
          pointerEvents="box-none"
          onLayout={(event) => setCtaHeight(event.nativeEvent.layout.height)}
          style={[styles.cta, { paddingBottom: bottomPad }]}>
          <PrimaryButton title={ctaTitle} onPress={onContinue} disabled={ctaDisabled} />
          {footer}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: onboarding.contentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.xxl,
  },
  heading: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  subtitle: {
    flexShrink: 1,
  },
  note: {
    marginTop: spacing.md,
  },
  ctaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  cta: {
    width: '100%',
    maxWidth: onboarding.contentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
});
