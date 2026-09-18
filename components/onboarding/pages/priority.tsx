import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChoiceRow, OnboardingScreen } from '@/components/onboarding';
import { OptionCard } from '@/components/ui';
import { SKILL_GOALS, SKILL_ICONS, SKILL_LABELS, SKILL_ORDER } from '@/constants/metrics';
import { spacing } from '@/constants/theme';
import { useSetting } from '@/hooks/use-settings';
import type { SkillKey } from '@/types/history';

/**
 * Step 4: what the user wants to work on. Seeds the cold-start recommendations
 * only; once there is enough history the measured profile decides
 * (`lib/recommendations.ts`). Nothing is preselected, and "Not sure yet" is a
 * real answer that stores null.
 */
export default function PriorityStep({ onContinue }: { onContinue: () => void }) {
  const [priority, setPriority] = useSetting('prioritySkill');
  const [writeFailed, setWriteFailed] = useState(false);
  // The store's default is already null, so "Not sure yet" cannot read its
  // selection from the value alone: it is selected once tapped, not on arrival.
  const [notSure, setNotSure] = useState(false);

  const choose = (value: SkillKey | null) => {
    setNotSure(value === null);
    if (value === priority) return;
    setWriteFailed(!setPriority(value));
  };

  return (
    <OnboardingScreen
      title="Find your focus"
      subtitle="Choose what you'd like to improve. Your practice will adapt as you complete sessions."
      ctaTitle="Continue"
      onContinue={() => {
        // "Not sure yet" stores null, which is also the untouched default, so
        // only a stamped write tells the two apart for the sync layer. Nothing
        // tapped is not an answer: the field stays unstamped so the account's
        // own choice can still arrive from another device.
        if (notSure || priority !== null) setWriteFailed(!setPriority(priority));
        onContinue();
      }}
      note={writeFailed ? 'That choice could not be saved. Your device may be out of storage.' : null}>
      <View style={styles.list}>
        {SKILL_ORDER.map((key) => (
          <OptionCard
            key={key}
            selected={priority === key}
            accessibilityLabel={SKILL_LABELS[key]}
            onSelect={() => choose(key)}>
            <ChoiceRow
              icon={SKILL_ICONS[key]}
              title={SKILL_LABELS[key]}
              caption={SKILL_GOALS[key]}
              selected={priority === key}
            />
          </OptionCard>
        ))}
        <OptionCard selected={notSure} accessibilityLabel="Not sure yet" onSelect={() => choose(null)}>
          <ChoiceRow
            title="Not sure yet"
            caption="Try a mix and find your focus."
            selected={notSure}
          />
        </OptionCard>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
});
