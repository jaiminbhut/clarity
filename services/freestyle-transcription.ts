/**
 * Server-side re-transcription of a finished freestyle recording.
 *
 * The platform recognizer is tuned for American English, so for Indian English
 * speakers it mishears words, and in both Indian English and Hindi it drops or
 * "corrects" hesitations, which is worse for scoring. After the session this sends the saved WAV through
 * `/api/transcribe` (Sarvam AI, verbatim mode) and the caller prefers that
 * transcript when it comes back.
 *
 * All or nothing: if any clip fails, this resolves `null` and the caller keeps
 * the live transcript. A transcript missing one clip would undercount words and
 * fillers and quietly skew pace, which is worse than the live one.
 */

// NOTE: the global fetch resolves `/api/...` against the dev server / origin;
// `expo/fetch` resolves relative URLs against file:/// (see ai-coaching.ts).
import { planQuietSplits, sliceWav } from '@/services/wav';

/** Under Sarvam's 30s REST cap, with room for the quiet-point search. */
const MAX_CLIP_MS = 25_000;

/** A handful at once: fast for a multi-minute session, gentle on rate limits. */
const MAX_CONCURRENT_CLIPS = 3;

/** The whole pass must not hold the user on the processing screen for long. */
const TOTAL_TIMEOUT_MS = 30_000;

export type TranscriptionFailure = 'request-failed' | 'timeout' | 'processing-failed';

export type TranscriptionOutcome =
  | { ok: true; transcript: string }
  | { ok: false; reason: TranscriptionFailure };

async function transcribeClip(
  clip: Uint8Array,
  language: TranscriptionLanguage,
  signal: AbortSignal,
): Promise<string> {
  const body: Uint8Array<ArrayBuffer> = new Uint8Array(clip);
  const response = await fetch(`/api/transcribe?language=${language}`, {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body,
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('transcript' in payload) ||
    typeof payload.transcript !== 'string'
  ) {
    throw new Error('Malformed transcription response');
  }
  return payload.transcript.trim();
}

/** The locales `/api/transcribe` accepts. */
export type TranscriptionLanguage = 'en-IN' | 'hi-IN';

export async function transcribeFreestyleRecording(
  wav: Uint8Array,
  language: TranscriptionLanguage,
): Promise<TranscriptionOutcome> {
  let clips: Uint8Array[];
  try {
    clips = planQuietSplits(wav, MAX_CLIP_MS).map((span) =>
      sliceWav(wav, span.startMs, span.endMs),
    );
  } catch (error) {
    if (__DEV__) console.warn('[transcription] could not split recording:', error);
    return { ok: false, reason: 'processing-failed' };
  }
  if (clips.length === 0) return { ok: false, reason: 'processing-failed' };

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TOTAL_TIMEOUT_MS);

  const texts: string[] = new Array(clips.length).fill('');
  let next = 0;
  const worker = async () => {
    while (!controller.signal.aborted) {
      const index = next++;
      if (index >= clips.length) return;
      texts[index] = await transcribeClip(clips[index], language, controller.signal);
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT_CLIPS, clips.length) }, worker),
    );
    return { ok: true, transcript: texts.filter(Boolean).join(' ') };
  } catch (error) {
    // One failed clip dooms the pass; stop the others instead of paying for them.
    controller.abort();
    if (__DEV__) console.warn('[transcription] failed:', error);
    return { ok: false, reason: timedOut ? 'timeout' : 'request-failed' };
  } finally {
    clearTimeout(timeout);
  }
}
