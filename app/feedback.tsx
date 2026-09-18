import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { GlassSurface, PrimaryButton, ThemedText } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { assessmentInput } from '@/convex/assessmentSchema';
import { coachingSchema } from '@/convex/coachPrompt';
import { savedFeedbackEntries, subscribeFeedback, subscribePro } from '@/services/pro-access';

function SavedReport({ entry }: { entry: ReturnType<typeof savedFeedbackEntries>[number] }) {
  const [expanded, setExpanded] = useState(false);
  const coaching = entry.key.startsWith('coach/') ? coachingSchema.safeParse(entry.value) : null;
  const assessment = entry.key.startsWith('assessment/') ? assessmentInput.safeParse(entry.value) : null;
  if (!coaching?.success && !assessment?.success) return null;
  return <GlassSurface style={{ padding: spacing.lg }}>
    <View style={{ gap: spacing.md }}>
      <ThemedText variant="title3">{coaching?.success ? 'Personal coaching' : 'Pronunciation report'}</ThemedText>
      <ThemedText variant="bodyProse" tone="secondary">
        {coaching?.success ? coaching.data.summary : assessment?.success ? `Accuracy ${Math.round(assessment.data.accuracy)} · Fluency ${Math.round(assessment.data.fluency)}` : ''}
      </ThemedText>
      <PrimaryButton title={expanded ? 'Hide details' : 'Read report'} size="md" onPress={() => setExpanded(value => !value)} />
      {expanded && coaching?.success ? coaching.data.tips.map((tip, index) => <View key={index} style={{ gap: spacing.xs }}>
        <ThemedText variant="headline">{tip.title}</ThemedText>
        <ThemedText variant="bodyProse">{tip.guidance}</ThemedText>
        <ThemedText variant="footnoteProse" tone="secondary">{tip.evidence}</ThemedText>
      </View>) : null}
      {expanded && assessment?.success ? assessment.data.words.map((word, index) => <View key={index} style={{ gap: spacing.xs }}>
        <ThemedText variant="headline">{word.word} · {word.score == null ? word.status : Math.round(word.score)}</ThemedText>
        {word.phonemes?.length ? <ThemedText variant="bodyProse" tone="secondary">{word.phonemes.map(sound => `/${sound.phoneme}/ ${sound.score == null ? '—' : Math.round(sound.score)}`).join(' · ')}</ThemedText> : null}
        {word.prosody?.unexpectedBreak || word.prosody?.missingBreak || word.prosody?.monotone ? <ThemedText variant="footnoteProse" tone="secondary">{[word.prosody.unexpectedBreak && 'Unexpected pause', word.prosody.missingBreak && 'Missing pause', word.prosody.monotone && 'Limited pitch variation'].filter(Boolean).join(' · ')}</ThemedText> : null}
      </View>) : null}
    </View>
  </GlassSurface>;
}

export default function SavedFeedbackScreen() {
  const [entries, setEntries] = useState(savedFeedbackEntries);
  useEffect(() => {
    const update = () => setEntries(savedFeedbackEntries());
    const stopFeedback = subscribeFeedback(update);
    const stopIdentity = subscribePro(update);
    update();
    return () => { stopFeedback(); stopIdentity(); };
  }, []);
  return <>
    <Stack.Screen options={{ headerTitle: () => <ThemedText variant="title3" weight="semibold">Saved feedback</ThemedText> }} />
    <FlatList data={entries} keyExtractor={entry => entry.key} renderItem={({ item }) => <SavedReport entry={item} />}
      contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      ListHeaderComponent={<ThemedText variant="bodyProse" tone="secondary">Completed reports stay yours to read, including on the free plan. Earlier sessions without saved feedback are not reanalyzed.</ThemedText>}
      ListEmptyComponent={<ThemedText variant="bodyProse">Your completed personal feedback will appear here.</ThemedText>} />
  </>;
}
