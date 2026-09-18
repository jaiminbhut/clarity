import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChoiceRow, OnboardingScreen } from '@/components/onboarding';
import { OptionCard } from '@/components/ui';
import { ACCENTS, hasPhonemeDetail, languageOf } from '@/constants/accents';
import { spacing } from '@/constants/theme';
import { useMarkInteractive } from '@/hooks/use-mark-interactive';
import { useSetting } from '@/hooks/use-settings';

/**
 * Step 2: the language and accent Azure grades against (Hindi is one of the
 * choices, and switches the practice language). The consequential question: the
 * same British reading scored 80 against en-US and 100 against en-GB
 * (`constants/accents.ts`). Asked before the first session so the first score
 * is a fair one.
 */
export default function AccentStep() {
  useMarkInteractive();
  const [accentLocale, setAccentLocale] = useSetting('accentLocale');
  const [writeFailed, setWriteFailed] = useState(false);

  return (
    <OnboardingScreen
      title="Which language and accent?"
      subtitle="Choose the closest match to how you speak. We use it to pick your practice language and give you fairer pronunciation feedback."
      ctaTitle="Continue"
      onContinue={() => {
        // Continue confirms the accent, including the preselected one nobody
        // tapped. `set` stamps an unchanged value for exactly this reason: an
        // unstamped field reads as "never answered on this device" and the
        // sync layer hands the account's older value back
        // (`lib/settings-store.ts`). A lost write still does not trap anyone
        // here; the note is for the tap path.
        setWriteFailed(!setAccentLocale(accentLocale));
        router.push('/(onboarding)/goal');
      }}
      note={
        writeFailed
          ? 'That choice could not be saved. Your device may be out of storage.'
          : languageOf(accentLocale) === 'hi'
            ? 'You will practice in Hindi, scored on words, fluency and completeness. Sound-by-sound tips are available for American English.'
            : !hasPhonemeDetail(accentLocale)
              ? 'Sound-by-sound tips are available for American English. This accent still includes word and syllable scores.'
              : null
      }>
      <View style={styles.list}>
        {ACCENTS.map((accent) => (
          <OptionCard
            key={accent.locale}
            selected={accent.locale === accentLocale}
            accessibilityLabel={`${accent.label}, ${accent.region}`}
            onSelect={() => {
              if (accent.locale === accentLocale) return;
              setWriteFailed(!setAccentLocale(accent.locale));
            }}>
            <ChoiceRow title={accent.label} caption={accent.region} selected={accent.locale === accentLocale} />
          </OptionCard>
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
});
