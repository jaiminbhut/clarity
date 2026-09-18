import { useAuth } from '@clerk/expo';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { clearAccountData } from '@/services/account';
import { getLastSignedInUserId, setLastSignedInUserId } from '@/services/auth-state';
import { forgetPurchaser } from '@/services/purchases';

/** Unmount every account consumer BEFORE clearing or adopting another identity.
 * This also covers remote revocation and Clerk account switching, which never
 * pass through the Settings sign-out handler. Cached same-account access still
 * renders immediately while Clerk loads offline. */
export function AccountBoundary({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const current = isSignedIn && userId ? userId : null;
  const [prepared, setPrepared] = useState(getLastSignedInUserId);
  useEffect(() => {
    if (!isLoaded || prepared === current) return;
    if (prepared !== null || getLastSignedInUserId() !== null) {
      clearAccountData();
      void forgetPurchaser().catch(() => {});
    }
    setLastSignedInUserId(current);
    setPrepared(current);
  }, [isLoaded, current, prepared]);
  if (isLoaded && prepared !== current) return null;
  return <Fragment key={prepared ?? 'signed-out'}>{children}</Fragment>;
}
