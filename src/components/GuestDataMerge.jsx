/**
 * GuestDataMerge.jsx — headless one-time guest→account data merge.
 *
 * When the resolved userId transitions to a real signed-in account, moves any 'guest'-owned
 * data into that account (one-time, non-destructive — see migrateGuestData.js), then refreshes
 * the session/player/tendency views so the merged data appears without a page reload.
 *
 * Rendered inside Session/Player/Tendency providers (see AppProviders) so it can trigger their
 * reloads. Renders nothing.
 */

import { useEffect, useRef } from 'react';
import { migrateGuestDataToUser } from '../utils/persistence/migrateGuestData';
import { GUEST_USER_ID } from '../constants/authConstants';
import { useSession } from '../contexts/SessionContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useTendency } from '../contexts/TendencyContext';
import { logger } from '../utils/errorHandler';

export const GuestDataMerge = ({ userId }) => {
  const { loadAllSessions } = useSession();
  const { loadAllPlayers } = usePlayer();
  const { refresh: refreshTendencies } = useTendency();
  const attemptedRef = useRef(new Set());

  useEffect(() => {
    if (!userId || userId === GUEST_USER_ID) return;
    if (attemptedRef.current.has(userId)) return; // one attempt per account per session
    attemptedRef.current.add(userId);

    let cancelled = false;
    migrateGuestDataToUser(userId)
      .then((res) => {
        if (cancelled || !res?.migrated) return;
        // Surface the moved data without forcing a reload.
        loadAllSessions?.();
        loadAllPlayers?.();
        refreshTendencies?.();
      })
      .catch((err) => {
        attemptedRef.current.delete(userId); // allow a retry on the next auth tick
        logger?.error?.('GuestDataMerge failed', err);
      });

    return () => { cancelled = true; };
  }, [userId, loadAllSessions, loadAllPlayers, refreshTendencies]);

  return null;
};

export default GuestDataMerge;
