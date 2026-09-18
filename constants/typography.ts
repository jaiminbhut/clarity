/**
 * The type ramp. Named steps, mirroring the Apple text-style sizes so the app
 * feels native, rendered in the app typeface (see `fonts`).
 *
 * Each step carries a size, a default face, and its optical tracking. Nothing
 * carries color: `colors` is keyed by scheme and resolves at render time, so a
 * static style object can't hold ink. Components apply color from `useTheme()`.
 *
 * Weight comes from a `fonts` face, spread into the step, never a bare
 * `fontWeight`. On iOS each face is its own family; a mismatched `fontWeight`
 * makes iOS synthesize the weight or fall back to the system font. On Android
 * the face carries the weight that selects a file from the linked family.
 *
 * Render these through `<ThemedText variant="..." />` so screens never touch
 * `fontSize`. Pass `weight` to override the default face at the same size.
 *
 * `lineHeight` is set only on the `prose` steps. Multi-line copy needs it; a
 * single-line label doesn't, and setting it there shifts the text in its box.
 */

import type { TextStyle } from 'react-native';

import { fonts } from './fonts';

export const type = {
  /** The opening welcome screen's two-line promise. */
  welcomeDisplay: { fontSize: 48, ...fonts.bold, letterSpacing: -1.5, lineHeight: 52 },
  welcomeDisplayCompact: { fontSize: 44, ...fonts.bold, letterSpacing: -1.3, lineHeight: 48 },
  welcomeBody: { fontSize: 19, ...fonts.medium, lineHeight: 26 },
  /** Screen-level heading outside a navigation header. */
  largeTitle: { fontSize: 34, ...fonts.bold, letterSpacing: -0.5 },
  /** Section hero, and the big number in a results header. */
  title: { fontSize: 22, ...fonts.bold, letterSpacing: -0.3 },
  title3: { fontSize: 20, ...fonts.semibold, letterSpacing: -0.3 },
  /** The default for anything that names something: card titles, row labels. */
  headline: { fontSize: 17, ...fonts.semibold, letterSpacing: -0.2 },
  body: { fontSize: 17, ...fonts.regular },
  callout: { fontSize: 16, ...fonts.semibold, letterSpacing: -0.2 },
  subhead: { fontSize: 15, ...fonts.semibold },
  /** Captions, units, meta rows. The most-used step in the app. */
  footnote: { fontSize: 13, ...fonts.medium },
  caption: { fontSize: 12, ...fonts.medium },
  /** All-caps label above a value. Tracking is wide because it is uppercase. */
  eyebrow: { fontSize: 12, ...fonts.bold, letterSpacing: 1 },
  /** Smallest readable step: day letters, tiny pills. */
  micro: { fontSize: 10, ...fonts.semibold, letterSpacing: 0.5 },

  /** A counter card's hero number. Heavier and larger than `title` because it
   * is the whole point of its card; the label beside it is the caption. */
  displayValue: { fontSize: 26, ...fonts.heavy, letterSpacing: -0.5 },

  // --- Marketing site ---
  // These mirror the desktop and mobile ramps in the Paper landing page.
  marketingWordmark: {
    fontSize: 20,
    ...fonts.bold,
    letterSpacing: -0.6,
    lineHeight: 24,
  },
  marketingWordmarkMobile: {
    fontSize: 18,
    ...fonts.bold,
    letterSpacing: -0.54,
    lineHeight: 20,
  },
  marketingDisplay: {
    fontSize: 84,
    ...fonts.semibold,
    letterSpacing: -2.94,
    lineHeight: 84,
  },
  marketingDisplayMobile: {
    fontSize: 48,
    ...fonts.semibold,
    letterSpacing: -1.68,
    lineHeight: 48,
  },
  marketingSection: {
    fontSize: 52,
    ...fonts.semibold,
    letterSpacing: -1.82,
    lineHeight: 56,
  },
  marketingSectionMobile: {
    fontSize: 36,
    ...fonts.semibold,
    letterSpacing: -1.26,
    lineHeight: 40,
  },
  marketingFeature: { fontSize: 22, ...fonts.semibold, lineHeight: 28 },
  marketingFeatureMobile: { fontSize: 20, ...fonts.semibold, lineHeight: 24 },
  marketingBody: { fontSize: 18, ...fonts.regular, lineHeight: 28 },
  marketingBodyMobile: { fontSize: 16, ...fonts.regular, lineHeight: 24 },
  marketingHeroBodyMobile: { fontSize: 17, ...fonts.regular, lineHeight: 24 },
  marketingEyebrow: { fontSize: 18, ...fonts.semibold, lineHeight: 24 },
  marketingEyebrowMobile: { fontSize: 16, ...fonts.semibold, lineHeight: 24 },
  marketingNav: { fontSize: 14, ...fonts.medium, lineHeight: 18 },
  marketingNavStrong: { fontSize: 14, ...fonts.semibold, lineHeight: 18 },
  marketingButton: { fontSize: 14, ...fonts.semibold, lineHeight: 20 },
  marketingButtonMobile: { fontSize: 16, ...fonts.semibold, lineHeight: 20 },
  marketingKickerMobile: { fontSize: 14, ...fonts.semibold, lineHeight: 20 },
  marketingMeta: { fontSize: 12, ...fonts.medium, lineHeight: 20 },
  marketingMetaMobile: { fontSize: 13, ...fonts.medium, lineHeight: 20 },

  // --- Prose: multi-line copy, so these carry leading ---
  bodyProse: { fontSize: 17, ...fonts.regular, lineHeight: 24 },
  subheadProse: { fontSize: 15, ...fonts.regular, lineHeight: 21 },
  footnoteProse: { fontSize: 13, ...fonts.regular, lineHeight: 19 },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
