/**
 * OnlineStakesBackfill.jsx — headless one-time WS-260 stakes re-key.
 *
 * Runs backfillOnlineStakes for the resolved userId (guest included) once per app run:
 * legacy online sessions labeled 'NL Holdem' get their real stakes derived from their
 * stored hands' captured blinds, so the pool baseline segments online populations by
 * stake. Idempotent — after the first pass there is nothing left to touch.
 *
 * Rendered inside SessionProvider (see AppProviders) so a successful re-key can refresh
 * the sessions view without a reload. Renders nothing.
 */

import { useEffect, useRef } from 'react';
import { backfillOnlineStakes } from '../utils/persistence/backfillOnlineStakes';
import { useSession } from '../contexts/SessionContext';
import { logger } from '../utils/errorHandler';

export const OnlineStakesBackfill = ({ userId }) => {
  const { loadAllSessions } = useSession();
  const attemptedRef = useRef(new Set());

  useEffect(() => {
    if (!userId) return;
    if (attemptedRef.current.has(userId)) return; // one attempt per userId per app run
    attemptedRef.current.add(userId);

    let cancelled = false;
    backfillOnlineStakes(userId)
      .then((res) => {
        if (cancelled || !res?.updated) return;
        loadAllSessions?.(); // surface the re-keyed labels without a reload
      })
      .catch((err) => {
        attemptedRef.current.delete(userId); // allow a retry on the next auth tick
        logger?.error?.('OnlineStakesBackfill failed', err);
      });

    return () => { cancelled = true; };
  }, [userId, loadAllSessions]);

  return null;
};

export default OnlineStakesBackfill;
