/**
 * The accents a reader can be graded against.
 *
 * This is not a cosmetic setting. Azure grades pronunciation against a reference
 * accent, and the wrong one is scored as an error: the same British reading of
 * the same sentence measured 80 accuracy against `en-US` and 100 against
 * `en-GB`. A user with a non-American accent was losing twenty points to the
 * default.
 *
 * The list is short on purpose. Every locale here was measured against the live
 * short-audio endpoint and behaves distinctly. Eight further English locales
 * (`en-IE`, `en-NZ`, `en-ZA`, `en-SG`, `en-PH`, `en-HK`, `en-NG`, `en-KE`)
 * returned byte-identical scores to each other across two different speakers,
 * so they appear to share one fallback model and are left out rather than
 * offered as five distinct choices that do the same thing.
 *
 * PURE module — no React. Safe under bun.
 */

import type { AccentLocale, PracticeLanguage } from '@/types/settings';

export type Accent = {
  locale: AccentLocale;
  /** The language this choice practices in. */
  language: PracticeLanguage;
  /** What the user calls their accent, not the locale code. */
  label: string;
  /** Country or region, for the row's secondary line. */
  region: string;
};

/**
 * `en-US` is first and is the default. Beyond fair scoring it is also the ONLY
 * locale that returns phoneme SYMBOLS: every other English locale returns the
 * phoneme tier with scores but empty symbol strings, under both the IPA and SAPI
 * alphabets. Syllable scores survive everywhere because the grapheme is always
 * present. `PHONEME_DETAIL_LOCALES` is what the UI reads to say so out loud
 * rather than letting the feature quietly disappear.
 */
export const ACCENTS: readonly Accent[] = [
  { locale: 'en-US', language: 'en', label: 'American', region: 'English · United States' },
  { locale: 'en-GB', language: 'en', label: 'British', region: 'English · United Kingdom' },
  { locale: 'en-AU', language: 'en', label: 'Australian', region: 'English · Australia' },
  { locale: 'en-CA', language: 'en', label: 'Canadian', region: 'English · Canada' },
  { locale: 'en-IN', language: 'en', label: 'Indian', region: 'English · India' },
  // Hindi is last: it changes the practice language, not only the accent.
  // Azure assesses hi-IN at word level (accuracy, fluency, completeness); like
  // the non-US English accents it returns no phoneme symbols.
  { locale: 'hi-IN', language: 'hi', label: 'Hindi', region: 'हिन्दी · Practice in Hindi' },
] as const;

export const DEFAULT_ACCENT: AccentLocale = 'en-US';

/** Locales that return per-sound (phoneme) symbols, measured, not assumed. */
export const PHONEME_DETAIL_LOCALES: readonly AccentLocale[] = ['en-US'] as const;

export function hasPhonemeDetail(locale: AccentLocale): boolean {
  return PHONEME_DETAIL_LOCALES.includes(locale);
}

export function accentFor(locale: AccentLocale): Accent {
  return ACCENTS.find((accent) => accent.locale === locale) ?? ACCENTS[0];
}

export function languageOf(locale: AccentLocale): PracticeLanguage {
  return accentFor(locale).language;
}

/**
 * The locale a session over `text` is heard and graded in. The passage's own
 * script decides the language, so a Hindi passage is always read in Hindi and
 * an English one in English, whatever the setting says now. Within English the
 * user's accent applies; a Hindi speaker reading English is graded as Indian
 * English rather than against a General American reference.
 */
export function localeForText(language: PracticeLanguage, preferred: AccentLocale): AccentLocale {
  if (language === 'hi') return 'hi-IN';
  return languageOf(preferred) === 'en' ? preferred : 'en-IN';
}

/**
 * The locale the on-device recognizer listens in. English stays on `en-US`
 * for every accent: the passage hints and the aligner were tuned against it,
 * and the accent only matters to Azure's grading. Hindi must listen in Hindi.
 */
export function recognizerLocale(locale: AccentLocale): string {
  return languageOf(locale) === 'hi' ? 'hi-IN' : 'en-US';
}
