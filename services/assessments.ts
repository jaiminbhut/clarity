import { assessmentInput } from '@/convex/assessmentSchema';
import { applyAssessment, getRecords } from '@/services/session-history';
import { summarizeWords } from '@/services/ai-coaching';
import { saveFeedback } from '@/services/pro-access';
import type { SessionResult } from '@/types/session';
import { kv } from '@/services/kv';
import { getLastSignedInUserId } from '@/services/auth-state';

type PendingAssessment = { sessionId: string; sessionKey: string; payload: string };
const listeners = new Set<() => void>();
export const subscribeAssessments = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const pendingKey = () => `pro/${getLastSignedInUserId()}/pending-assessments`;
export function getPendingAssessments(): PendingAssessment[] { try { return JSON.parse(kv.getString(pendingKey()) ?? '[]'); } catch { return []; } }
export function acknowledgeAssessment(sessionId: string) { kv.set(pendingKey(), JSON.stringify(getPendingAssessments().filter(row => row.sessionId !== sessionId))); }
export function applySavedAssessment(sessionId: string, payload: string) {
  const data = assessmentInput.safeParse(JSON.parse(payload));
  if (!data.success) return false;
  const result = applyAssessment(sessionId, { ...data.data, endedReason: getRecords().find(row => row.id === sessionId)?.endedReason ?? 'stopped' });
  if (result) saveFeedback(`assessment/${sessionId}`, data.data);
  return result;
}
export function saveAssessment(sessionId: string, sessionKey: string, result: SessionResult) {
  const record = getRecords().find(row => row.id === sessionId);
  if (!record || result.source !== 'azure') return;
  const { wordCounts, challengingWords } = summarizeWords(result.words);
  const payload = JSON.stringify({ mode: record.mode, durationMs: record.durationMs,
    accuracy: result.accuracy, fluency: result.fluency, completeness: result.completeness, intonation: result.intonation,
    paceWpm: result.paceWpm, targetWpm: result.targetWpm, fillerCount: result.fillerCount, spokenWords: result.spokenWords,
    source: 'azure', pauseCount: result.pauseCount ?? undefined, longestPauseMs: result.longestPauseMs ?? undefined,
    wordCounts, challengingWords, words: result.words.slice(0, 2000).map(({ word, status, score, phonemes, syllables, prosody }) => ({ word, status, score, phonemes, syllables, prosody })) });
  if (!applySavedAssessment(sessionId, payload)) throw new Error('Detailed feedback could not be saved. Please try again.');
  const pending = getPendingAssessments().filter(row => row.sessionId !== sessionId);
  kv.set(pendingKey(), JSON.stringify([...pending, { sessionId, sessionKey, payload }]));
  listeners.forEach(fn => fn());
}
