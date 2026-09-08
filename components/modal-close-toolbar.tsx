import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Stack } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Diameter of the Android close circle. Matches the iOS 26 toolbar button. */
const BUTTON_SIZE = 40;

/**
 * The close control in a modal's native header (Settings, the passage editor,
 * the paywall).
 *
 * iOS gets the stack toolbar's own `xmark` button, which iOS 26 renders as a
 * glass circle. `Stack.Toolbar.Button` accepts only an image source on
 * Android, so there the same slot holds a plain pressable circle with the
 * Hugeicons glyph instead of rendering nothing.
 */
export function ModalCloseToolbar({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={onPress} />
      </Stack.Toolbar>
    );
  }

  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onPress}
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.fillStrong, opacity: pressed ? 0.7 : 1 },
          ]}>
          <HugeiconsIcon icon={Cancel01Icon} size={20} color={colors.foreground} strokeWidth={2} />
        </Pressable>
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}

const styles = StyleSheet.create({
  // Toolbar views need one child with explicit width/height.
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
