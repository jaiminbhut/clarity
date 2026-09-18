import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChoiceRow, OnboardingScreen } from '@/components/onboarding';
import { OptionCard } from '@/components/ui';
import { ACCENTS, hasPhonemeDetail } from '@/constants/accents';
import { spacing } from '@/constants/theme';
import { useSetting } from '@/hooks/use-settings';

/**
 * Step 2: the accent Azure grades against. The consequential question: the
 * same British reading scored 80 against en-US and 100 against en-GB
 * (`constants/accents.ts`). Asked before the first session so the first score
 * is a fair one.
 */
export default function AccentStep({ onContinue }: { onContinue: () => void }) {
  const [accentLocale, setAccentLocale] = useSetting('accentLocale');
  const [writeFailed, setWriteFailed] = useState(false);

  return (
    <OnboardingScreen
      title="Which accent feels closest?"
      subtitle="Choose the closest match to how you speak. We use it to give you fairer pronunciation feedback."
      ctaTitle="Continue"
      onContinue={() => {
        // Continue confirms the accent, including the preselected one nobody
        // tapped. `set` stamps an unchanged value for exactly this reason: an
        // unstamped field reads as "never answered on this device" and the
        // sync layer hands the account's older value back
        // (`lib/settings-store.ts`). A lost write still does not trap anyone
        // here; the note is for the tap path.
        setWriteFailed(!setAccentLocale(accentLocale));
        onContinue();
      }}
      note={
        writeFailed
          ? 'That choice could not be saved. Your device may be out of storage.'
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
