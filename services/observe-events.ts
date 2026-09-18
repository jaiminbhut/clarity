/**
 * The app's EAS Observe event catalog.
 *
 * Every `Observe.logEvent` call in the app goes through this module. Event names
 * are the grouping key in the dashboard and renaming one splits its history in
 * two, so they are declared once here instead of typed out at each call site.
 * Attributes leave the device, so keeping the payloads in one file makes what we
 * export reviewable without reading through the session engine.
 *
 * Rules for anything added here:
 * - Names are lowercase, dot-separated, and never change once shipped. Pair each
 *   with a `displayName`, which is what the dashboard's session timeline shows;
 *   grouping still keys off `name`, so the label is free to read like a sentence.
 * - No user content. Passage text, transcripts, freestyle topics, and custom
 *   passage titles stay on device; content ids, counts, durations, and scores
 *   are what ship.
 * - Every call is fire-and-forget. `logEvent` persists the event locally and
 *   returns; the batch is dispatched alongside the metrics when the app
 *   backgrounds.
 *
 * None of this leaves a debug build unless EXPO_PUBLIC_OBSERVE_IN_DEV=1 is set,
 * because the `Observe.configure` call in `app/_layout.tsx` drops debug-build
 * metrics by default.
 */

import { Observe } from 'expo-observe';
import { randomUUID } from 'expo-crypto';

import type { SessionEndedReason, SessionMode } from '@/types/history';
import type { PracticeErrorCode, SessionResult } from '@/types/session';
import type { AccentLocale } from '@/types/settings';

/** eventId survives transport retries, allowing duplicate deliveries to be deduplicated. */
function logEvent(name: string, options: NonNullable<Parameters<typeof Observe.logEvent>[1]>) {
  try {
    Observe.logEvent(name, { ...options, attributes: { ...options.attributes, eventId: randomUUID() } });
  } catch {
    // Telemetry must never turn a saved result or successful purchase into an error.
  }
}

// ---- global attributes ------------------------------------------------------

/**
 * Attributes merged into every metric and log event, so the automatic startup
 * and navigation timings can be sliced by them too and not just the events below.
 *
 * `setGlobalAttributes` takes the whole map (passing an empty object clears it)
 * rather than merging into what is already there, so the app's copy is held here
 * and re-sent in full whenever one value changes.
 */
const globals: Record<string, string | number | boolean> = {};

function setGlobal(key: string, value: string | number | boolean) {
  if (globals[key] === value) return;
  globals[key] = value;
  Observe.setGlobalAttributes(globals);
}

/**
 * Which speech engine this build practices with. Mirrors the switch in
 * `hooks/use-practice-session.ts`, read from the env var rather than imported so
 * this module does not pull the recognition engine in behind it.
 *
 * Worth tagging on everything: a mock session never touches the recognizer or
 * Azure, so its timings and scores must not be read as field data.
 */
setGlobal('event_schema_version', 2);
setGlobal('practice_engine', process.env.EXPO_PUBLIC_MOCK_PRACTICE === '1' ? 'mock' : 'real');

/**
 * Whether Clarity Pro is active. Called by the subscription provider whenever
 * the entitlement resolves or changes, so every later metric carries the tier
 * the customer was actually on — including startup TTI, which is the one place
 * a slow first customer-info read would show up.
 */
export function setSubscriptionTier(tier: 'pro' | 'free' | 'unknown') {
  setGlobal('subscription_tier', tier);
}

/**
 * Whether a Clerk session is active. Set by the auth bridge whenever Clerk
 * settles, so sign-in funnel metrics and everything after can be split by it.
 */
export function setAuthState(state: 'signed-in' | 'signed-out') {
  setGlobal('auth_state', state);
}

// ---- practice lifecycle -----------------------------------------------------

/**
 * An attempt began. Emitted from `beginSession`, the one call every start goes
 * through: the passage, drill, and freestyle screens all open their crash
 * checkpoint there, and so does a restart mid-read.
 */
export function practiceStarted(a: {
  attemptId: string;
  previewId?: string;
  mode: SessionMode;
  passageId?: string;
  topicId?: string;
  targetWpm?: number;
}) {
  logEvent('practice.started', {
    displayName: 'Practice started',
    attributes: {
      attemptId: a.attemptId,
      ...(a.previewId ? { previewId: a.previewId } : {}),
      mode: a.mode,
      // Ids only. A custom passage's title is the user's own writing.
      contentId: a.passageId ?? a.topicId ?? 'unknown',
      targetWpm: a.targetWpm ?? 0,
    },
  });
}

/**
 * An attempt reached an end. Emitted from `recordSession`, the single funnel
 * every terminal path uses — finished the passage, stopped early, or abandoned
 * by dismissing or restarting mid-read — in both passage and freestyle mode.
 *
 * `scoringSource: live` is the normal basic result. Paid assessment happens
 * later and has its own assessment.* events; it is not a degradation signal.
 */
export function practiceEnded(
  result: SessionResult,
  meta: { attemptId: string; mode: SessionMode; endedReason: SessionEndedReason; persisted: boolean; persistenceReason: string },
) {
  logEvent('practice.ended', {
    displayName: 'Practice ended',
    attributes: {
      attemptId: meta.attemptId,
      mode: meta.mode,
      endedReason: meta.endedReason,
      scoringSource: result.source,
      durationMs: result.durationMs,
      score: result.overallScore,
      paceWpm: result.paceWpm,
      targetWpm: result.targetWpm,
      spokenWords: result.spokenWords,
      fillerCount: result.fillerCount,
      hasAudio: result.audioUri != null,
      // False also covers "nothing was spoken, so there was nothing to save",
      // which is why it is a separate signal from `endedReason`.
      persisted: meta.persisted,
      persistenceReason: meta.persistenceReason,
    },
  });
}

/**
 * The engine gave up before it could produce a result. `code` is the same
 * discriminant the error UI branches on, so a spike in 'recognition-unavailable'
 * points at devices and 'permission-denied' points at the onboarding ask.
 */
export function practiceFailed(a: { attemptId: string; code: PracticeErrorCode; mode: SessionMode }) {
  logEvent('practice.failed', {
    displayName: 'Practice failed',
    severity: 'error',
    attributes: { attemptId: a.attemptId, code: a.code, mode: a.mode },
  });
}

/** The basic stop-and-process path failed; paid assessment failures use assessment.failed. */
export type ScoringDegradedReason = 'processing-failed';

export function scoringDegraded(a: {
  reason: ScoringDegradedReason;
  mode: SessionMode;
  locale: AccentLocale;
  durationMs: number;
}) {
  logEvent('practice.scoring_degraded', {
    displayName: 'Scoring degraded',
    severity: 'warn',
    attributes: { mode: a.mode, reason: a.reason, locale: a.locale, durationMs: a.durationMs },
  });
}

/**
 * On-device recognition could not start, so the engine retried over the network.
 * Both latency and transcript quality change with it, which means a session that
 * fell back is not comparable to one that did not.
 */
export function recognitionFallback(a: { mode: SessionMode; reason: string }) {
  logEvent('practice.recognition_fallback', {
    displayName: 'Recognition fell back to network',
    severity: 'warn',
    attributes: { mode: a.mode, from: 'on-device', to: 'network', reason: a.reason },
  });
}

/**
 * The recorded WAV segments could not be assembled. Scores survive, but the
 * attempt has no playback and its waveform is reconstructed from the mic meter,
 * so Results silently loses a feature rather than showing an error.
 */
export function audioProcessingFailed(a: { mode: SessionMode; segments: number }) {
  logEvent('practice.audio_processing_failed', {
    displayName: 'Audio processing failed',
    severity: 'warn',
    attributes: { mode: a.mode, segments: a.segments },
  });
}

// ---- lifecycle correlation --------------------------------------------------

/** Random telemetry identifiers only. Never reuse a grant, session key, or user ID. */
export const newTelemetryId = () => randomUUID();

export function beginPracticeAttempt(a: Omit<Parameters<typeof practiceStarted>[0], 'attemptId'>) {
  const id = newTelemetryId();
  let settled = false;
  practiceStarted({ ...a, attemptId: id });
  return {
    id,
    end(result: SessionResult, meta: Omit<Parameters<typeof practiceEnded>[1], 'attemptId' | 'mode'>) {
      if (settled) return;
      settled = true;
      practiceEnded(result, { ...meta, attemptId: id, mode: a.mode });
    },
    cancel() {
      if (settled) return;
      settled = true;
      logEvent('practice.cancelled', { displayName: 'Practice cancelled before a result', attributes: { attemptId: id, mode: a.mode } });
    },
    fail(code: PracticeErrorCode) {
      if (settled) return;
      settled = true;
      practiceFailed({ attemptId: id, mode: a.mode, code });
    },
  };
}
export type PracticeAttempt = ReturnType<typeof beginPracticeAttempt>;

/** Deliberately allowlisted: provider messages and arbitrary error codes can contain user content. */
const failureCodes = [
  'authentication_required', 'upgrade_required', 'preview_exhausted', 'preview_expired',
  'recording_unavailable', 'provider_failure', 'processing', 'temporarily_throttled',
  'invalid_request', 'timeout', 'cancelled',
] as const;
export function telemetryFailure(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && failureCodes.some(value => value === code)) return code;
  if (error instanceof TypeError) return 'network_or_runtime';
  return 'unknown';
}

type FeedbackContext = { attemptId?: string; previewId?: string; mode: SessionMode; preview: boolean; cached?: boolean };
/** One ID and at most one terminal event per request, including retries and cancellation. */
export function beginFeedbackOperation(kind: 'assessment' | 'coaching', context: FeedbackContext) {
  const operationId = newTelemetryId();
  const start = performance.now();
  let settled = false;
  const attributes = { ...context, operationId };
  logEvent(`${kind}.started`, { displayName: `${kind} started`, attributes });
  return {
    finish(outcome: 'completed' | 'failed' | 'cancelled', reason?: string) {
      if (settled) return;
      settled = true;
      logEvent(`${kind}.${outcome}`, {
        displayName: `${kind} ${outcome}`,
        severity: outcome === 'failed' ? 'warn' : 'info',
        attributes: { ...attributes, durationMs: Math.round(performance.now() - start), ...(reason ? { reason } : {}) },
      });
    },
  };
}

// ---- monetization -----------------------------------------------------------

export type PaywallSource = 'explicit' | 'coach' | 'pronunciation' | 'exercise' | 'assessment' | 'analytics' | 'unknown';
export function paywallSource(value: string | undefined): PaywallSource {
  return value === undefined ? 'explicit'
    : ['explicit', 'coach', 'pronunciation', 'exercise', 'assessment', 'analytics'].includes(value) ? value as PaywallSource : 'unknown';
}
type PaywallAttributes = { paywallId: string; source: PaywallSource };
type PurchaseAttributes = PaywallAttributes & { operationId: string };
type ProEvents = {
  feature_tapped: { feature: Exclude<PaywallSource, 'explicit' | 'unknown'> };
  paywall_viewed: PaywallAttributes;
  paywall_ready: PaywallAttributes & { durationMs: number; planCount: number };
  paywall_failed: PaywallAttributes & { reason: 'store_unavailable' | 'no_plans' | 'offering_failed'; durationMs: number };
  paywall_closed: PaywallAttributes & { outcome: 'dismissed' | 'unlocked'; durationMs: number; ready: boolean };
  purchase_started: PurchaseAttributes & { product: string };
  purchase_resolved: PurchaseAttributes & { product: string; outcome: 'purchased' | 'pending' | 'failed' | 'cancelled'; durationMs: number };
  purchase_blocked: PaywallAttributes & { reason: 'identity_not_ready'; action: 'purchase' | 'restore' };
  restore_started: PurchaseAttributes;
  restore_resolved: PurchaseAttributes & { outcome: 'restored' | 'nothingToRestore' | 'failed'; durationMs: number };
  verification_resolved: PurchaseAttributes & { action: 'purchase' | 'restore'; outcome: 'verified' | 'pending' | 'failed'; durationMs: number };
  activated: PurchaseAttributes & { action: 'purchase' | 'restore' };
  preview_requested: { previewId: string };
  preview_started: { previewId: string };
  preview_failed: { previewId: string; reason: string };
  // Completion means coaching has finished, after any required assessment.
  preview_completed: { attemptId?: string; previewId?: string };
};

export function proEvent<K extends keyof ProEvents>(event: K, attributes: ProEvents[K]) {
  const outcome = 'outcome' in attributes ? attributes.outcome : undefined;
  logEvent(`pro.${event}`, {
    displayName: `Clarity Pro ${event.replaceAll('_', ' ')}`,
    severity: event.endsWith('_failed') || outcome === 'failed' ? 'warn' : 'info',
    attributes,
  });
}

const completedPreviews = new WeakSet<object>();
/** Results remounts and cached coaching must not count the same preview twice. */
export function completePreview(result: SessionResult) {
  const context = result.premiumContext;
  if (!context?.grantId || completedPreviews.has(context)) return;
  completedPreviews.add(context);
  proEvent('preview_completed', { attemptId: result.telemetryAttemptId, previewId: result.telemetryPreviewId });
}

/** A view means the route opened; ready means purchasable plans actually loaded. */
export function beginPaywallVisit(source: PaywallSource) {
  const attributes = { paywallId: newTelemetryId(), source };
  const start = performance.now();
  let closed = false;
  let loaded = false;
  let loadSettled = false;
  const durationMs = () => Math.round(performance.now() - start);
  proEvent('paywall_viewed', attributes);
  return {
    attributes,
    ready(planCount: number) {
      if (closed || loadSettled) return;
      loaded = true;
      loadSettled = true;
      proEvent('paywall_ready', { ...attributes, planCount, durationMs: durationMs() });
    },
    failed(reason: ProEvents['paywall_failed']['reason']) {
      if (closed || loadSettled) return;
      loadSettled = true;
      proEvent('paywall_failed', { ...attributes, reason, durationMs: durationMs() });
    },
    close(outcome: 'dismissed' | 'unlocked') {
      if (closed) return;
      closed = true;
      proEvent('paywall_closed', { ...attributes, outcome, ready: loaded, durationMs: durationMs() });
    },
  };
}
