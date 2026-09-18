import * as Crypto from 'expo-crypto';
import { kv } from '@/services/kv';
import { getLastSignedInUserId } from '@/services/auth-state';
import type { PremiumFeature } from '@/convex/proPolicy';

export type ProStatus = { isPro: boolean; expiresAt: number | null; checkedAt: number; remaining: number; resetsAt: number };
export type PremiumContext = { sessionKey: string; grantId?: string };
const EMPTY: ProStatus = { isPro: false, expiresAt: null, checkedAt: 0, remaining: 0, resetsAt: 0 };
let snapshot = EMPTY;
let identity: string | null = null;
let tokenProvider: (() => Promise<string | null>) | null = null;
const listeners = new Set<() => void>();
const feedbackListeners = new Set<() => void>();
export const subscribeFeedback = (fn: () => void) => { feedbackListeners.add(fn); return () => { feedbackListeners.delete(fn); }; };
const emit = () => listeners.forEach(fn => fn());
export const subscribePro = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getProStatus = () => snapshot;
export const getPremiumIdentity = () => identity;
export const newOperationId = () => Crypto.randomUUID();
export function setPremiumIdentity(owner: string | null, getToken: (() => Promise<string | null>) | null) {
  tokenProvider = getToken;
  if (identity === owner) return;
  identity = owner;
  refresh = null;
  snapshot = EMPTY;
  if (owner) {
    try { const saved = kv.getString(`pro/${owner}/status`); if (saved) snapshot = JSON.parse(saved); } catch { /* offline defaults */ }
  }
  emit();
}
export function applyProStatus(value: ProStatus) {
  if (!identity) return;
  snapshot = value;
  kv.set(`pro/${identity}/status`, JSON.stringify(value));
  emit();
}
export class PremiumError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'PremiumError'; }
}
export function isUpgradeError(error: unknown) {
  return error instanceof PremiumError && ['upgrade_required', 'preview_exhausted', 'preview_expired'].includes(error.code);
}
function origin() {
  const value = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || process.env.EXPO_PUBLIC_CONVEX_URL?.replace(/\.convex\.cloud$/, '.convex.site');
  if (!value) throw new PremiumError('provider_failure', 'Personal feedback is temporarily unavailable.');
  return value.replace(/\/$/, '');
}
export async function premiumFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const owner = identity;
  const token = await tokenProvider?.();
  if (!owner || owner !== identity || !token) throw new PremiumError('authentication_required', 'Sign in to use personal feedback.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${origin()}${path}`, { ...init, method: 'POST', headers });
  if (owner !== identity) throw new PremiumError('authentication_required', 'Your account changed. Please try again.');
  if (!response.ok || response.status === 202) {
    const body = await response.json().catch(() => ({}));
    throw new PremiumError(body.code || 'provider_failure', body.error || 'Personal feedback is temporarily unavailable.');
  }
  return response;
}
let refresh: Promise<ProStatus> | null = null;
export function refreshProAccess(): Promise<ProStatus> {
  if (refresh) return refresh;
  const owner = identity;
  const pending = premiumFetch('/api/pro/status').then(r => r.json()).then((value: ProStatus) => {
    if (owner === identity) applyProStatus(value);
    return value;
  }).finally(() => { if (refresh === pending) refresh = null; });
  refresh = pending;
  return pending;
}
export async function beginPreview(sessionKey: string): Promise<PremiumContext> {
  const response = await premiumFetch('/api/pro/preview', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionKey }) });
  const { grantId } = await response.json();
  const context = { sessionKey, grantId };
  savePreviewContext(context);
  void refreshProAccess().catch(() => {});
  return context;
}
export function savePreviewContext(context: PremiumContext) {
  if (identity) kv.set(`pro/${identity}/preview`, JSON.stringify(context));
}
export async function releasePreview(sessionKey: string) {
  await premiumFetch('/api/pro/preview-release', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionKey }) });
  if (getPreviewContext()?.sessionKey === sessionKey && identity) kv.remove(`pro/${identity}/preview`);
  await refreshProAccess();
}
export function getPreviewContext(): PremiumContext | undefined {
  try {
    const value = identity && kv.getString(`pro/${identity}/preview`);
    return value ? JSON.parse(value) : undefined;
  } catch { return undefined; }
}
export function premiumHeaders(operationId: string, context: PremiumContext): Record<string, string> {
  return { 'X-Operation-Id': operationId, 'X-Session-Key': context.sessionKey, ...(context.grantId ? { 'X-Preview-Id': context.grantId } : {}) };
}
export async function requestPremium(path: string, init: RequestInit, signal?: AbortSignal) {
  const owner = identity;
  for (let attempt = 0; ; attempt++) {
    if (owner !== identity) throw new PremiumError('authentication_required', 'Your account changed. Please try again.');
    if (signal?.aborted) throw new Error('Cancelled');
    try { return await premiumFetch(path, { ...init, signal }); }
    catch (error) {
      const retryable = error instanceof PremiumError
        ? ['processing', 'temporarily_throttled'].includes(error.code) && attempt < 60
        : error instanceof TypeError && attempt < 2;
      if (!retryable || signal?.aborted) throw error;
      await new Promise<void>((resolve, reject) => {
        const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
        const timer = setTimeout(done, 2000);
        const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Cancelled')); };
        signal?.addEventListener('abort', abort, { once: true });
      });
    }
  }
}
export function cachedFeedback<T>(key: string): T | null {
  const owner = identity ?? getLastSignedInUserId();
  if (!owner) return null;
  try { const value = kv.getString(`pro/${owner}/feedback/${key}`); return value ? JSON.parse(value) : null; } catch { return null; }
}
export function saveFeedback(key: string, value: unknown) {
  if (!identity) return;
  const storageKey = `pro/${identity}/feedback/${key}`;
  const json = JSON.stringify(value);
  if (kv.getString(storageKey) === json) return;
  kv.set(storageKey, json);
  feedbackListeners.forEach(fn => fn());
}
export function savedFeedbackEntries(): { key: string; value: unknown }[] {
  const owner = identity ?? getLastSignedInUserId();
  if (!owner) return [];
  const prefix = `pro/${owner}/feedback/`;
  return kv.getAllKeys().filter(key => key.startsWith(prefix)).sort().reverse().flatMap(key => {
    try { return [{ key: key.slice(prefix.length), value: JSON.parse(kv.getString(key)!) }]; } catch { return []; }
  });
}
export function clearPremiumData() {
  identity = null;
  tokenProvider = null;
  refresh = null;
  for (const key of kv.getAllKeys()) if (key.startsWith('pro/')) kv.remove(key);
  snapshot = EMPTY;
  emit();
}
export type { PremiumFeature };
