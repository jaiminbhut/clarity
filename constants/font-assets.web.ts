import { fonts } from './fonts';

/** The landing page uses four faces; the native-only heavy face stays out of
 * web, where `fonts.web.ts` aliases it onto bold. Google Sans Flex Rounded
 * rather than SF Pro Rounded: see the license note in `fonts.web.ts`. */
export const fontAssets = {
  [fonts.regular.fontFamily]: require('@/assets/fonts/marketing/GoogleSansFlexRounded-Regular.woff2'),
  [fonts.medium.fontFamily]: require('@/assets/fonts/marketing/GoogleSansFlexRounded-Medium.woff2'),
  [fonts.semibold.fontFamily]: require('@/assets/fonts/marketing/GoogleSansFlexRounded-SemiBold.woff2'),
  [fonts.bold.fontFamily]: require('@/assets/fonts/marketing/GoogleSansFlexRounded-Bold.woff2'),
};
