import type { TextStyle } from 'react-native';

export type FontFace = Pick<TextStyle, 'fontFamily' | 'fontWeight'>;

export type FontFaceName = 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy';

/** Google Sans Flex Rounded — the web typeface, and the reason web does not
 * simply share `fonts.ts` with iOS.
 *
 * SF Pro is licensed by Apple for app UI on Apple platforms; converting it to
 * woff2 and serving it from our own domain is webfont embedding, which that
 * license does not grant. The Android faces already in `assets/fonts/android/`
 * are SIL OFL (see `OFL.txt` beside them, no Reserved Font Name), so the same
 * design language ships to the browser with a license that permits it.
 *
 * Unlike Android, each weight is its own single-face family: expo-font's web
 * loader maps a family NAME to one file, so a shared family plus `fontWeight`
 * would resolve to whichever face registered last. Same keys as `fonts.ts`.
 *
 * `heavy` points at Bold on purpose. The landing page never asks for it, so the
 * 800 face is not shipped to the browser; aliasing it degrades to a real loaded
 * face instead of dropping to the system sans.
 */
const face = (weight: string) => ({ fontFamily: `GoogleSansFlexRounded-${weight}` });

export const fonts = {
  regular: face('Regular'),
  medium: face('Medium'),
  semibold: face('SemiBold'),
  bold: face('Bold'),
  heavy: face('Bold'),
} as const satisfies Record<FontFaceName, FontFace>;
