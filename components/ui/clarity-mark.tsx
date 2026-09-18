import Svg, { Circle, Ellipse } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/** Clarity's seven-dot brand mark, traced from the source app-icon artwork. */
export function ClarityMark({ size, tone = 'primary' }: { size: number; tone?: 'primary' | 'marketing' }) {
  const { colors } = useTheme();
  const ink = tone === 'marketing' ? colors.marketingInk : colors.foreground;

  return (
    <Svg width={size} height={size} viewBox="0 0 873 812" accessibilityRole="image" accessibilityLabel="Clarity">
      {/* These coordinates are the original logo geometry, not layout values. */}
      <Ellipse cx="436.5" cy="81.5" rx="138.5" ry="81.5" fill={ink} />
      <Ellipse cx="436.5" cy="730.5" rx="138.5" ry="81.5" fill={ink} />
      <Ellipse
        cx="728.883"
        cy="264.534"
        rx="138.5"
        ry="81.5"
        transform="rotate(56.9213 728.883 264.534)"
        fill={ink}
      />
      <Ellipse
        cx="143.883"
        cy="569.534"
        rx="138.5"
        ry="81.5"
        transform="rotate(56.9213 143.883 569.534)"
        fill={ink}
      />
      <Ellipse
        cx="143.883"
        cy="264.534"
        rx="138.5"
        ry="81.5"
        transform="rotate(-56.9213 143.883 264.534)"
        fill={ink}
      />
      <Ellipse
        cx="728.883"
        cy="569.534"
        rx="138.5"
        ry="81.5"
        transform="rotate(-56.9213 728.883 569.534)"
        fill={ink}
      />
      <Circle cx="437.5" cy="408.5" r="138.5" fill={ink} />
    </Svg>
  );
}
