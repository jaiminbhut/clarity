/** Shared, pure policy. Billing cadence deliberately does not appear here. */
export const PRO_ENTITLEMENT = 'Clarity Pro';
export const PREVIEW_MS = 90_000;
export const MONTHLY_PREVIEWS = 2;
export const PREVIEW_LEASE_MS = 30 * 60_000;
export const OPERATION_LEASE_MS = 2 * 60_000;
export type PremiumFeature = 'assessment' | 'coach' | 'exercise' | 'pronunciation' | 'analytics';
export function monthWindow(now: number) {
  const date = new Date(now);
  return {
    month: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    resetsAt: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  };
}
export function activePro(value: { active: boolean; expiresAt: number | null } | null, now: number) {
  return !!value?.active && (value.expiresAt === null || value.expiresAt > now);
}
export function previewInUse(value: { committed: boolean; leaseUntil: number }, now: number) {
  return value.committed || value.leaseUntil > now;
}
export function wavDuration(bytes: Uint8Array, rejectSilence = false): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));
  if (bytes.length < 44 || bytes.length > 950_000 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Invalid WAV');
  if (view.getUint32(4, true) !== bytes.length - 8) throw new Error('Invalid WAV length');
  let validFormat = false;
  let dataBytes = 0;
  let low = 32767;
  let high = -32768;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true);
    if (offset + 8 + size > bytes.length) throw new Error('Truncated WAV');
    if (tag(offset) === 'fmt ') {
      validFormat = size >= 16 && view.getUint16(offset + 8, true) === 1 &&
        view.getUint16(offset + 10, true) === 1 && view.getUint32(offset + 12, true) === 16000 &&
        view.getUint32(offset + 16, true) === 32000 && view.getUint16(offset + 20, true) === 2 &&
        view.getUint16(offset + 22, true) === 16;
    }
    if (tag(offset) === 'data') {
      if (size % 2) throw new Error('Invalid WAV samples');
      dataBytes += size;
      if (rejectSilence) for (let i = offset + 8; i < offset + 8 + size; i += 2) {
        const sample = view.getInt16(i, true);
        low = Math.min(low, sample);
        high = Math.max(high, sample);
      }
    }
    offset += 8 + size + size % 2;
  }
  const duration = dataBytes / 32;
  if (!validFormat || duration <= 0 || duration > 28_000) throw new Error('Unsupported WAV');
  // Reject digital silence/DC without an amplitude threshold that could reject
  // a quiet speaker. Native recognition also skips sessions with no words.
  if (rejectSilence && low === high) throw new Error('Silent WAV');
  return duration;
}
