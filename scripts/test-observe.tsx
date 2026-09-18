/// <reference types="bun" />
import { mock } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SessionResult } from '../types/session';
import type { SessionCheckpointArgs, SessionCheckpointHandle } from '../hooks/use-session-checkpoint';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let passed = 0;
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
  passed++;
}
type Event = { name: string; attributes: Record<string, unknown>; severity?: string };
const events: Event[] = [];
let globalAttributes: Record<string, unknown> = {};
let rejectTelemetry = false;
mock.module('expo-observe', () => ({ Observe: {
  setGlobalAttributes: (attributes: Record<string, unknown>) => { globalAttributes = { ...attributes }; },
  logEvent: (name: string, options: { attributes: Record<string, unknown>; severity?: string }) => {
    if (rejectTelemetry) throw new Error('Native telemetry unavailable');
    events.push({ name, attributes: { ...globalAttributes, ...options.attributes }, severity: options.severity });
  },
} }));
mock.module('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }));
const telemetry = await import('../services/observe-events');
const result: SessionResult = {
  overallScore: 80, accuracy: 80, fluency: 80, completeness: 80, intonation: 80,
  paceWpm: 110, targetWpm: 120, fillerCount: 0, spokenWords: 20, words: [],
  audioUri: 'private-recording.wav', durationMs: 10000, waveform: [], source: 'live',
  transcript: 'Private speech must never be logged',
};
const ended = { endedReason: 'stopped' as const, persisted: true, persistenceReason: 'saved' };
const named = (name: string) => events.filter(event => event.name === name);

// A delayed callback for an old attempt cannot finish a newer attempt or emit twice.
const first = telemetry.beginPracticeAttempt({ mode: 'passage', passageId: 'built-in' });
const next = telemetry.beginPracticeAttempt({ mode: 'passage' });
first.end(result, ended);
first.end(result, ended);
first.cancel();
next.fail('permission-denied');
next.end(result, ended);
check(named('practice.ended').length === 1, 'Duplicate completion and cleanup emit one terminal event');
check(named('practice.ended')[0].attributes.attemptId === first.id, 'Delayed completion retains its own attempt');
check(named('practice.failed')[0].attributes.attemptId === next.id, 'Failure belongs to the newer attempt');
check(first.id !== next.id, 'Each attempt gets a distinct ID');
check(events.every(event => event.attributes.event_schema_version === 2), 'New events are distinguishable from old semantics');
check(new Set(events.map(event => event.attributes.eventId)).size === events.length, 'Each logical event has a unique delivery ID');
check(!JSON.stringify(events).includes('Private speech') && !JSON.stringify(events).includes('private-recording'), 'Speech and audio paths are excluded');
check(telemetry.telemetryFailure({ code: 'private text', message: 'private text' }) === 'unknown', 'Untrusted error details are not exported');
check(telemetry.telemetryFailure({ code: 'recording_unavailable' }) === 'recording_unavailable', 'Known failures remain actionable');
rejectTelemetry = true;
first.cancel();
telemetry.beginPracticeAttempt({ mode: 'freestyle' }).end(result, ended);
rejectTelemetry = false;
check(true, 'Native logging failure does not fail practice');

// A screen opening is separate from actually displaying purchasable plans.
events.length = 0;
const unavailable = telemetry.beginPaywallVisit('explicit');
unavailable.failed('store_unavailable');
unavailable.close('dismissed');
unavailable.ready(2);
check(named('pro.paywall_ready').length === 0, 'Unavailable or closed paywall cannot become a ready impression');
check(named('pro.paywall_failed').length === 1, 'Unavailable store has a structured outcome');
const ready = telemetry.beginPaywallVisit('coach');
ready.ready(2);
ready.ready(2);
ready.close('unlocked');
ready.close('dismissed');
check(named('pro.paywall_ready').length === 1, 'Plans produce one ready impression');
check(named('pro.paywall_closed').length === 2, 'Button close followed by unmount emits once per visit');
check(named('pro.paywall_closed')[1].attributes.outcome === 'unlocked', 'Cleanup cannot overwrite purchase unlock');
check(telemetry.paywallSource('private route text') === 'unknown', 'Route source is allowlisted');

// Exercise the actual checkpoint hook used by BOTH session screens.
let checkpointClears = 0;
mock.module('react-native', () => ({ View: 'View', AppState: { addEventListener: () => ({ remove() {} }) } }));
mock.module('../services/session-history', () => ({
  beginSession: (session: Parameters<typeof telemetry.beginPracticeAttempt>[0], previewId?: string) => telemetry.beginPracticeAttempt({ ...session, previewId }),
  checkpointSession() {},
  endSession() { checkpointClears++; },
}));
const { useSessionCheckpoint } = await import('../hooks/use-session-checkpoint');
let handle: SessionCheckpointHandle;
function Checkpoint(props: SessionCheckpointArgs) { handle = useSessionCheckpoint(props); return null; }
const checkpointProps: SessionCheckpointArgs = {
  status: 'listening', error: null, retryToken: 0, previewId: 'random-preview', elapsedMs: 0, spokenWords: 0, fillerCount: 0,
  meta: { mode: 'freestyle', topicId: 'built-in', targetWpm: 120 }, onBackground() {},
};
events.length = 0;
let renderer: ReactTestRenderer;
await act(async () => { renderer = create(createElement(Checkpoint, checkpointProps)); });
const initialAttempt = handle!.attempt;
initialAttempt.end(result, ended);
handle!.end();
await act(async () => { renderer!.update(createElement(Checkpoint, { ...checkpointProps, retryToken: 1 })); });
const retryAttempt = handle!.attempt;
check(named('practice.started').length === 2 && initialAttempt.id !== retryAttempt.id, 'Results Retry rearms checkpoint and emits a fresh start');
check(named('practice.started')[0].attributes.previewId === 'random-preview' && named('practice.started')[1].attributes.previewId === undefined, 'Preview attempt is correlated, and Results Retry does not reuse that preview');
await act(async () => { renderer!.update(createElement(Checkpoint, { ...checkpointProps, retryToken: 1, elapsedMs: 500 })); });
check(named('practice.started').length === 2, 'Progress rerenders never emit extra starts');
await act(async () => { renderer!.update(createElement(Checkpoint, { ...checkpointProps, retryToken: 1, status: 'error', error: { code: 'permission-denied', message: 'Private native error' } })); });
handle!.end();
check(named('practice.failed').length === 1 && named('practice.cancelled').length === 0, 'Engine error plus dismissal has one failed terminal event');
check(checkpointClears === 2, 'End still clears the durable checkpoint');
await act(async () => renderer!.unmount());

// Run real coaching effects to verify pending, failed, retried and cached previews.
let resolveCoaching: (value: { summary: string; tips: [] }) => void;
let rejectCoaching: (error: Error) => void;
let cached = false;
class TestPremiumError extends Error { constructor(public code: string, message: string) { super(message); } }
mock.module('../services/pro-access', () => ({
  cachedFeedback: () => cached ? { summary: 'cached' } : null,
  getPremiumIdentity: () => 'private-account',
  PremiumError: TestPremiumError,
  isUpgradeError: () => false,
}));
mock.module('../services/ai-coaching', () => ({
  requestAiCoaching: () => new Promise((resolve, reject) => { resolveCoaching = resolve; rejectCoaching = reject; }),
}));
const { useAiCoaching } = await import('../hooks/use-ai-coaching');
let retryCoaching: () => void;
function Coaching({ result }: { result: SessionResult }) { retryCoaching = useAiCoaching(result).retry; return null; }
const preview = { ...result, telemetryAttemptId: 'random-attempt', telemetryPreviewId: 'random-preview', premiumContext: { sessionKey: 'secret-key', grantId: 'secret-grant' } };
events.length = 0;
await act(async () => { renderer = create(createElement(Coaching, { result: preview })); });
check(named('pro.preview_completed').length === 0, 'Starting coaching does not complete a preview');
await act(async () => { rejectCoaching!(new Error('Private provider response')); });
check(named('coaching.failed').length === 1 && named('pro.preview_completed').length === 0, 'Failed coaching leaves preview incomplete');
await act(async () => retryCoaching!());
await act(async () => { resolveCoaching!({ summary: 'Private coaching text', tips: [] }); });
check(named('coaching.started').length === 2 && named('coaching.completed').length === 1, 'Coaching retry has its own operation');
check(named('pro.preview_completed').length === 1, 'Preview completes after successful coaching');
await act(async () => renderer!.unmount());
check(named('coaching.cancelled').length === 0, 'Unmount after success does not add cancellation');
cached = true;
await act(async () => { renderer = create(createElement(Coaching, { result: preview })); });
await act(async () => { resolveCoaching!({ summary: 'cached', tips: [] }); });
check(named('pro.preview_completed').length === 1, 'Reopening cached feedback does not complete preview twice');
check(named('coaching.started').at(-1)?.attributes.cached === true, 'Cached reads can be excluded from provider latency');
await act(async () => renderer!.unmount());
await act(async () => { renderer = create(createElement(Coaching, { result })); });
await act(async () => renderer!.unmount());
await act(async () => { resolveCoaching!({ summary: 'too late', tips: [] }); });
check(named('coaching.cancelled').length === 1, 'Leaving pending coaching emits cancellation, never a late completion');
const exported = JSON.stringify(events);
check(!['secret-key', 'secret-grant', 'Private provider', 'Private coaching'].some(value => exported.includes(value)), 'Feedback telemetry excludes credentials and generated content');
// Assessment must settle before coaching is shown, and must preserve correlation.
mock.module('expo-router', () => ({ router: {} }));
mock.module('../components/ui', () => ({ GlassSurface: 'View', PrimaryButton: 'Button', ThemedText: 'Text' }));
mock.module('../constants/theme', () => ({ spacing: {} }));
mock.module('../components/session/ai-coaching-card', () => ({ AiCoachingCard: () => null }));
mock.module('../hooks/use-pro-access', () => ({ useProAccess: () => ({ isPro: true }) }));
mock.module('../hooks/use-paywall', () => ({ usePaywall: () => ({ requirePro: async (action: () => void) => action() }) }));
let failSaving = false;
mock.module('../services/assessments', () => ({ saveAssessment() { if (failSaving) throw new Error('private disk path'); } }));
const { PremiumFeedback } = await import('../components/session/premium-feedback');
let resolveAssessment: (value: SessionResult) => void;
let rejectAssessment: (error: Error) => void;
const assess = () => new Promise<SessionResult>((resolve, reject) => { resolveAssessment = resolve; rejectAssessment = reject; });
const input = { ...preview, assess };
let assessedResult: SessionResult | undefined;
const onResult = (result: SessionResult) => { assessedResult = result; };
const feedback = () => createElement(PremiumFeedback, { result: input, recordId: 'private-record', onResult });
cached = false;
events.length = 0;
await act(async () => { renderer = create(feedback()); });
await act(async () => { resolveAssessment!({ ...result, source: 'azure', premiumContext: preview.premiumContext }); });
check(named('assessment.completed').length === 1, 'Assessment success has its own terminal event');
check(named('pro.preview_completed').length === 0, 'Assessment alone never marks full preview completed');
check(assessedResult?.telemetryAttemptId === preview.telemetryAttemptId && assessedResult?.telemetryPreviewId === preview.telemetryPreviewId, 'Assessment preserves attempt and preview correlation for coaching');
await act(async () => renderer!.unmount());
failSaving = true;
await act(async () => { renderer = create(feedback()); });
await act(async () => { resolveAssessment!({ ...result, source: 'azure' }); });
check(named('assessment.failed').at(-1)?.attributes.reason === 'persistence_failed', 'Assessment persistence failure is separate from provider failure');
await act(async () => renderer!.unmount());
failSaving = false;
await act(async () => { renderer = create(feedback()); });
await act(async () => { rejectAssessment!(new TestPremiumError('recording_unavailable', 'Private audio path')); });
check(named('assessment.failed').at(-1)?.attributes.reason === 'recording_unavailable', 'Missing recording is a bounded assessment failure');
await act(async () => renderer!.unmount());
await act(async () => { renderer = create(feedback()); });
await act(async () => renderer!.unmount());
await act(async () => { resolveAssessment!({ ...result, source: 'azure' }); });
check(named('assessment.cancelled').length === 1 && named('assessment.completed').length === 1, 'Leaving assessment ignores late success and closes telemetry once');
check(!JSON.stringify(events).includes('private-'), 'Assessment events exclude account, record, and audio identifiers');
console.log(`Observe: ${passed} checks passed`);
