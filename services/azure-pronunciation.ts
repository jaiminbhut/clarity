/** Authenticated transport. Provider credentials only exist on Convex. */
import * as Crypto from 'expo-crypto';
import { premiumHeaders, premiumFetch, requestPremium, type PremiumContext } from '@/services/pro-access';
import { parseAssessmentResponse, type ChunkAssessment } from './azure-assessment';
export * from './azure-assessment';
type Config = { context: PremiumContext; locale?: string };
export async function assessChunk(wavBytes: Uint8Array, referenceText: string, config: Config): Promise<ChunkAssessment | null> {
  const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,
    Array.from(wavBytes).join(',') + referenceText + (config.locale ?? 'en-US'));
  const response = await requestPremium('/api/speech-assessment', {
    headers: { ...premiumHeaders(fingerprint, config.context), 'Content-Type': 'audio/wav',
      'X-Reference-Text': encodeURIComponent(referenceText), 'X-Accent-Locale': config.locale ?? 'en-US' },
    body: new Uint8Array(wavBytes),
  });
  return parseAssessmentResponse(await response.json());
}
export async function assessSession(chunks: { wavBytes: Uint8Array; referenceText: string }[], config: Config): Promise<(ChunkAssessment | null)[]> {
  const results: (ChunkAssessment | null)[] = Array(chunks.length).fill(null);
  let next = 0;
  const outcomes = await Promise.allSettled(Array.from({ length: Math.min(3, chunks.length) }, async () => {
    while (next < chunks.length) {
      const index = next++;
      results[index] = await assessChunk(chunks[index].wavBytes, chunks[index].referenceText, config);
    }
  }));
  await premiumFetch('/api/pro/assessment-done', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionKey: config.context.sessionKey }) }).catch(() => {});
  const failed = outcomes.find(outcome => outcome.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  return results;
}
