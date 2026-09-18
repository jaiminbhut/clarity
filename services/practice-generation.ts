import { addPassage } from '@/services/user-passages';
import { getPremiumIdentity, getPreviewContext, newOperationId, premiumHeaders, requestPremium } from '@/services/pro-access';
/** Generated exercises are saved in the personal library for later practice. */
import type { Passage } from '@/types/session';

/** Matches the editor's "Slow" pace option: these are the user's hardest words. */
const TARGET_WPM = 120;

let current: Passage | null = null;
let currentOwner: string | null = null;

/** Resolver for lib/passage-catalog.ts; only the latest generation is live. */
export function getGeneratedPassage(id: string | undefined): Passage | undefined {
  return currentOwner === getPremiumIdentity() && current && current.id === id ? current : undefined;
}

export async function generateWordPracticePassage(
  words: readonly string[],
): Promise<Passage> {
  const owner = getPremiumIdentity();
  const operationId = newOperationId();
  const context = getPreviewContext() ?? { sessionKey: operationId };
  const response = await requestPremium('/api/practice-passage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...premiumHeaders(operationId, context) },
    body: JSON.stringify({ words }),
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Passage generation is unavailable right now.';
    throw new Error(message);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as { title?: unknown }).title !== 'string' ||
    typeof (payload as { text?: unknown }).text !== 'string'
  ) {
    throw new Error('The generated passage was incomplete.');
  }

  const { title, text } = payload as { title: string; text: string };
  if (owner !== getPremiumIdentity()) throw new Error('Your account changed. Please try again.');
  // Earned exercises live in the existing personal library and sync like other passages.
  current = addPassage({ title: title.trim(), text: text.trim(), targetWpm: TARGET_WPM });
  currentOwner = owner;
  if (!current) throw new Error('The exercise could not be saved. Please try again.');

  return current;
}
