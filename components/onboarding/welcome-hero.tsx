import { useCallback, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { ClarityMark } from '@/components/ui/clarity-mark';
import { ThemedText } from '@/components/ui';
import { motion, onboarding, radius, spacing } from '@/constants/theme';
import { useAppReady } from '@/hooks/use-mark-interactive';
import { useTheme } from '@/hooks/use-theme';

const welcome = onboarding.welcome;
const collage = welcome.collage;
const crops = collage.crops;

// Light-mode captures are intentional in both app themes.
const screenshots = {
  session: require('@/assets/onboarding/screenshots/session-light.jpg'),
  analytics: require('@/assets/onboarding/screenshots/analytics-light.jpg'),
  practice: require('@/assets/onboarding/screenshots/practice-light.jpg'),
  results: require('@/assets/onboarding/screenshots/results-light.jpg'),
  words: require('@/assets/onboarding/screenshots/words-light.jpg'),
};
const easeOut = cubicBezier(...motion.easeOut);
const rise = {
  from: { opacity: 0, transform: [{ translateY: collage.entranceDistance }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};
const descend = {
  from: { opacity: 0, transform: [{ translateY: -collage.entranceDistance }] },
  to: { opacity: 1, transform: [{ translateY: 0 }] },
};

type Crop = { x: number; y: number; width: number; height: number };
type Capture = { id: string; source: ImageSourcePropType; crop: Crop };
const columns: Capture[][] = [
  [
    { id: 'session', source: screenshots.session, crop: crops.session },
    { id: 'results', source: screenshots.results, crop: crops.results },
  ],
  [
    { id: 'analytics', source: screenshots.analytics, crop: crops.analytics },
    { id: 'words', source: screenshots.words, crop: crops.words },
  ],
  [
    { id: 'practice', source: screenshots.practice, crop: crops.practice },
    { id: 'skills', source: screenshots.analytics, crop: crops.skills },
  ],
];

/** A viewport into an unaltered app capture, with its original aspect ratio. */
function Screenshot({ source, crop, width, onLoadEnd }: Omit<Capture, 'id'> & {
  width: number;
  onLoadEnd: () => void;
}) {
  const { colors } = useTheme();
  const scale = width / crop.width;
  return (
    <View style={[styles.screenshot, { width, height: crop.height * scale }]}>
      <Image
        source={source}
        resizeMode="cover"
        fadeDuration={0}
        accessible={false}
        onLoadEnd={onLoadEnd}
        style={{
          position: 'absolute',
          width: collage.sourceWidth * scale,
          height: collage.sourceHeight * scale,
          left: -crop.x * scale,
          top: -crop.y * scale,
        }}
      />
      <View
        style={[StyleSheet.absoluteFill, styles.screenshotOutline, { borderColor: colors.divider }]}
      />
    </View>
  );
}

/** Actual dev-account screens. Three columns enter once, then stay still. */
export function WelcomeHero() {
  const { colors } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const appReady = useAppReady();
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const onLoaded = useCallback((id: string) => {
    setLoaded((previous) => previous.has(id) ? previous : new Set([...previous, id]));
  }, []);

  const width = Math.min(windowWidth, welcome.contentWidth);
  const compact = width < welcome.compactWidth;
  const columnWidth = (width + collage.bleed * 2 - spacing.sm * 2) / 3;
  const viewportRatio = compact ? collage.compactMaxViewportRatio : collage.maxViewportRatio;
  const maxHeight = Math.min(width * collage.heightRatio, windowHeight * viewportRatio);
  const ready = appReady && columns.every((column) => column.every(({ id }) => loaded.has(id)));

  return (
    <View style={styles.hero}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.collage, { maxHeight }]}>
        <View style={styles.columns}>
          {columns.map((captures, index) => (
            <View key={captures[0].id} style={{ marginTop: collage.columnOffsets[index] }}>
              <Animated.View
                testID={`welcome-column-${index}`}
                style={[
                  styles.column,
                  { opacity: ready ? 1 : 0 },
                  ready && !reducedMotion && {
                    animationName: index === 1 ? descend : rise,
                    animationDuration: collage.entranceDuration,
                    animationTimingFunction: easeOut,
                    animationIterationCount: 1,
                    animationFillMode: 'both',
                  },
                ]}>
                {captures.map(({ id, ...capture }) => (
                  <Screenshot key={id} {...capture} width={columnWidth} onLoadEnd={() => onLoaded(id)} />
                ))}
              </Animated.View>
            </View>
          ))}
        </View>
        <View
          style={[
            StyleSheet.absoluteFill,
            { experimental_backgroundImage: `linear-gradient(to bottom, ${colors.backgroundTransparent} ${collage.fadeStart}, ${colors.background} ${collage.fadeEnd})` },
          ]}
        />
      </View>
      <View style={styles.mark}>
        <ClarityMark size={compact ? welcome.compactMarkSize : welcome.markSize} />
      </View>
      <View style={styles.heading}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel="Speak clearly. Sound like you."
          style={styles.title}>
          {['Speak clearly.', 'Sound like you.'].map((line) => (
            <ThemedText
              key={line}
              variant={compact ? 'welcomeDisplayCompact' : 'welcomeDisplay'}
              maxFontSizeMultiplier={welcome.displayFontScale}
              adjustsFontSizeToFit
              numberOfLines={1}
              accessible={false}
              style={styles.centered}>
              {line}
            </ThemedText>
          ))}
        </View>
        <ThemedText
          variant="welcomeBody"
          tone="secondary"
          maxFontSizeMultiplier={welcome.displayFontScale}
          adjustsFontSizeToFit
          numberOfLines={2}
          style={styles.description}>
          Practice for the moments{'\n'}that matter to you.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, minHeight: 0, paddingBottom: spacing.xxxl },
  // The artwork gives up height first, keeping the copy and sign-in actions on screen.
  collage: { flex: 1, minHeight: welcome.markOverlap, overflow: 'hidden' },
  columns: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: -collage.bleed },
  column: { gap: spacing.sm },
  screenshot: { overflow: 'hidden', borderRadius: radius.sm, borderCurve: 'continuous' },
  screenshotOutline: { borderWidth: collage.outlineWidth, borderRadius: radius.sm, borderCurve: 'continuous' },
  mark: { alignItems: 'center', marginTop: -welcome.markOverlap },
  heading: { alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xxl, marginTop: spacing.xxl },
  title: { width: '100%' },
  centered: { textAlign: 'center' },
  description: { textAlign: 'center', maxWidth: welcome.copyWidth },
});
