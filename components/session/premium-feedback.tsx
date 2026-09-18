import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { GlassSurface, PrimaryButton, ThemedText } from '@/components/ui';
import { AiCoachingCard } from '@/components/session/ai-coaching-card';
import { useProAccess } from '@/hooks/use-pro-access';
import { usePaywall } from '@/hooks/use-paywall';
import { spacing } from '@/constants/theme';
import { PremiumError, cachedFeedback, getPremiumIdentity, isUpgradeError } from '@/services/pro-access';
import { saveAssessment } from '@/services/assessments';
import { beginFeedbackOperation, telemetryFailure } from '@/services/observe-events';
import type { SessionResult } from '@/types/session';

export function PremiumFeedback({ result, recordId, onResult }: { result: SessionResult; recordId: string | null; onResult: (result: SessionResult, recordId: string | null) => void }) {
  const access = useProAccess();
  const { requirePro } = usePaywall();
  const [error, setError] = useState<string | null>(null);
  const [recordingMissing, setRecordingMissing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [locked, setLocked] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  const operation = useRef<ReturnType<typeof beginFeedbackOperation> | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; operation.current?.finish('cancelled', 'screen_left'); }; }, []);
  const context = result.premiumContext;
  const saved = context && cachedFeedback(`coach/${context.sessionKey}/${result.source}`);
  const allowed = access.isPro || !!context?.grantId || !!saved;
  const assess = useCallback(async () => {
    if (!result.assess || !context || result.source === 'azure' || inFlight.current) return;
    const owner = getPremiumIdentity();
    inFlight.current = true;
    setProcessing(true);
    setError(null);
    setRecordingMissing(false);
    const telemetry = beginFeedbackOperation('assessment', { attemptId: result.telemetryAttemptId, previewId: result.telemetryPreviewId, mode: result.mode ?? 'passage', preview: !!context.grantId });
    operation.current = telemetry;
    let saving = false;
    try {
      const assessed = await result.assess(context);
      if (!alive.current || owner !== getPremiumIdentity()) {
        telemetry.finish('cancelled', 'screen_or_account_changed');
        return;
      }
      saving = true;
      if (recordId) saveAssessment(recordId, context.sessionKey, assessed);
      telemetry.finish('completed');
      onResult({ ...assessed, mode: result.mode, telemetryAttemptId: result.telemetryAttemptId, telemetryPreviewId: result.telemetryPreviewId }, recordId);
    } catch (cause) {
      telemetry.finish('failed', saving ? 'persistence_failed' : telemetryFailure(cause));
      if (!alive.current) return;
      if (isUpgradeError(cause)) setLocked(true);
      else {
        setRecordingMissing(cause instanceof PremiumError && cause.code === 'recording_unavailable');
        setError(cause instanceof Error ? cause.message : 'Detailed feedback is unavailable. Your basic results are saved.');
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setProcessing(false);
    }
  }, [context, onResult, recordId, result]);
  useEffect(() => { if (allowed && !locked && !saved) void assess(); }, [allowed, assess, locked, saved]);
  if (result.spokenWords <= 0) return null;
  if (!allowed || locked) return <GlassSurface style={{ padding: spacing.lg }}>
    <View style={{ gap: spacing.md }}>
      <ThemedText variant="title3">Personal feedback with Clarity Pro</ThemedText>
      <ThemedText variant="bodyProse" tone="secondary">{result.mode === 'freestyle' ? 'Get practical coaching on your pace, filler words, and how you express your ideas.' : 'Find the sounds to work on and get practice tailored to this recording.'}</ThemedText>
      <PrimaryButton title="Unlock feedback" size="md" onPress={() => { void requirePro(async () => { setLocked(false); await assess(); }, 'coach').catch(cause => setError(String(cause))); }} />
      {error ? <ThemedText variant="footnote" tone="secondary">{error}</ThemedText> : null}
    </View>
  </GlassSurface>;
  if (processing) return <ThemedText variant="bodyProse" tone="secondary">Analyzing your pronunciation… Your basic results are saved.</ThemedText>;
  if (error) return <View style={{ gap: spacing.md }}>
    <ThemedText variant="bodyProse" tone="secondary">{error}</ThemedText>
    <PrimaryButton size="md" title={recordingMissing ? "Start another practice" : "Retry detailed feedback"} onPress={() => recordingMissing ? router.dismissTo('/(tabs)/practice') : void assess()} />
  </View>;
  // Wait for pronunciation before coaching so tips refer to final measurements.
  if (result.assess && result.source === 'live' && !saved) return null;
  return <AiCoachingCard result={result} />;
}
