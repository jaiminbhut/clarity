import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui';
import { onboarding, radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChoiceRowProps = {
  title: string;
  caption?: string;
  selected: boolean;
  /** Optional leading glyph in a circular bed, for the skill picker. */
  icon?: IconSvgElement;
};

/**
 * The content of one onboarding choice, rendered inside an `OptionCard`. The
 * selection mark sits on the right, where the Settings rows already put it.
 */
export function ChoiceRow({ title, caption, selected, icon }: ChoiceRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {icon ? (
        <View
          style={[
            styles.iconBed,
            { backgroundColor: selected ? colors.accentBg : colors.fill },
          ]}>
          <HugeiconsIcon icon={icon} size={onboarding.iconSize} color={selected ? colors.accent : colors.secondary} />
        </View>
      ) : null}
      <View style={styles.text}>
        <ThemedText variant="headline" tone={selected ? 'accent' : 'primary'}>
          {title}
        </ThemedText>
        {caption ? (
          <ThemedText variant="footnote" tone="secondary">
            {caption}
          </ThemedText>
        ) : null}
      </View>
      {selected ? (
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={onboarding.checkSize} color={colors.accent} />
      ) : (
        <View style={[styles.radio, { borderColor: colors.track }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: onboarding.rowMinHeight,
  },
  iconBed: {
    width: onboarding.iconBed,
    height: onboarding.iconBed,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing.xxs,
  },
  radio: {
    width: onboarding.checkSize,
    height: onboarding.checkSize,
    borderRadius: radius.full,
    borderWidth: onboarding.radioBorder,
  },
});
