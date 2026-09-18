import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { buttons, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/** Button heights. Both clear the 44pt minimum touch target comfortably; `lg` is
 * for a screen's single committing action, `md` for one inside a card. */
const HEIGHTS = buttons.height;

export type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  icon?: IconSvgElement;
  /** Original provider artwork, such as Google's full-color brand asset. */
  iconImage?: ImageSourcePropType;
  variant?: 'primary' | 'secondary';
  size?: keyof typeof HEIGHTS;
  disabled?: boolean;
  /** Fires a medium impact on press. On by default: every existing caller wants
   * it, because this button always starts or commits something. */
  haptic?: boolean;
  /** Merged last, so callers can set margins without forking. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's one committing action: "Start Practicing", "Start Speaking", "Save".
 * A capsule of inverted glass — near-black on light, near-white on dark.
 *
 * Secondary actions use light-tinted glass with the same shape and type.
 *
 * The glass layer needs `tintColor` rather than a `backgroundColor`, and it
 * can't be nested inside another `GlassView` (nested glass doesn't render on
 * iOS 26) — so a card holding this button must render its own glass as an
 * absolute sibling, not as this button's ancestor.
 */
export function PrimaryButton({
  title,
  onPress,
  icon,
  iconImage,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  haptic = true,
  style,
}: PrimaryButtonProps) {
  const { colors } = useTheme();
  const hasGlass = isLiquidGlassAvailable();
  const secondary = variant === 'secondary';

  const handlePress = () => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const shape = [styles.button, { minHeight: HEIGHTS[size] }];
  const body = (
    <>
      {iconImage != null ? (
        <Image source={iconImage} accessible={false} resizeMode="contain" style={{ width: buttons.iconSize[size], height: buttons.iconSize[size] }} />
      ) : icon != null && (
        <HugeiconsIcon icon={icon} size={buttons.iconSize[size]} color={secondary ? colors.foreground : colors.inverseLabel} />
      )}
      <ThemedText variant="headline" tone={secondary ? 'primary' : 'inverse'} style={styles.label}>
        {title}
      </ThemedText>
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [pressed && styles.pressed, style]}>
      {hasGlass && !disabled ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          tintColor={secondary ? colors.glassTintStrong : colors.inverseSurface}
          style={shape}>
          {body}
        </GlassView>
      ) : secondary ? (
        <View style={[shape, { backgroundColor: colors.card, borderColor: colors.divider, borderWidth: buttons.borderWidth, opacity: disabled ? buttons.pressedOpacity : 1 }]}>
          {body}
        </View>
      ) : (
        <View
          style={[
            shape,
            { backgroundColor: disabled ? colors.inverseSurfaceMuted : colors.inverseSurface },
          ]}>
          {body}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  pressed: {
    opacity: buttons.pressedOpacity,
  },
});
