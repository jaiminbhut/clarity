import { useSyncExternalStore } from 'react';
import { getProStatus, subscribePro } from '@/services/pro-access';
export function useProAccess() {
  const value = useSyncExternalStore(subscribePro, getProStatus, getProStatus);
  return { ...value, isPro: value.isPro && (value.expiresAt === null || value.expiresAt > Date.now()), isLoading: value.checkedAt === 0 };
}
