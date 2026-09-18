import { useState } from 'react';
import { Alert, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { GlassSurface, PrimaryButton, ThemedText } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { PASSAGES } from '@/constants/passages';
import { useProAccess } from '@/hooks/use-pro-access';
import { beginPreview, newOperationId } from '@/services/pro-access';
import { newTelemetryId, proEvent, telemetryFailure } from '@/services/observe-events';

export function ProPreviewCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const access = useProAccess();
  const [busy, setBusy] = useState(false);
  if (access.isPro) return null;
  const start = async () => {
    if (busy) return;
    setBusy(true);
    const previewId = newTelemetryId();
    proEvent('preview_requested', { previewId });
    try {
      const context = await beginPreview(newOperationId());
      proEvent('preview_started', { previewId });
      router.push({ pathname: '/session/[passageId]', params: { passageId: PASSAGES[0].id, preview: '1', telemetryPreviewId: previewId, sessionKey: context.sessionKey, grantId: context.grantId } });
    } catch (error) {
      proEvent('preview_failed', { previewId, reason: telemetryFailure(error) });
      Alert.alert('Free feedback', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  };
  return <GlassSurface style={[{ padding: spacing.lg, marginBottom: spacing.xl }, style]}>
    <View style={{ gap: spacing.md }}>
      <ThemedText variant="title3">Try personal feedback</ThemedText>
      <ThemedText variant="bodyProse" tone="secondary">
        Practice for 90 seconds and get detailed pronunciation feedback, AI coaching, and a targeted exercise.
      </ThemedText>
      <ThemedText variant="footnote" tone="secondary">
        {access.isLoading ? 'One welcome session, plus two free sessions each month.' : `${access.remaining} free ${access.remaining === 1 ? 'session' : 'sessions'} available. Monthly previews reset ${new Date(access.resetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`}
      </ThemedText>
      <PrimaryButton size="md" title={busy ? 'Preparing feedback…' : !access.isLoading && access.remaining === 0 ? 'Explore Clarity Pro' : 'Try 90 seconds free'} disabled={busy}
        onPress={() => !access.isLoading && access.remaining === 0 ? router.push('/paywall') : void start()} />
      <ThemedText variant="footnote" tone="secondary">All basic practice stays free and unlimited.</ThemedText>
    </View>
  </GlassSurface>;
}
