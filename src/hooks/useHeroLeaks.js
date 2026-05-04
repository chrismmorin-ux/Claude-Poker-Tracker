/**
 * @file useHeroLeaks — React hook reading active hero-leak claims from IDB.
 *
 * Returns the leak (if any) for a given playerId + situationKey. Honors
 * snoozedUntil (7-day persistence) + session-local dismissedAt.
 *
 * Per `src/utils/skillAssessment/CLAUDE.md` source-util-policy whitelist:
 *   This hook MUST only be imported from HandReplayView (review-mode) or
 *   SelfCoachView. Live-table surfaces are blacklisted per chris-live-player.md
 *   autonomy red line #8.
 *
 * SPR-030 / WS-145 (2026-05-03).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getLeak, snoozeLeak } from '../utils/persistence/heroLeaksStore';

const isLeakActive = (leak) => {
  if (!leak) return false;
  const now = Date.now();
  if (leak.snoozedUntil && leak.snoozedUntil > now) return false;
  if (leak.dismissedAt) return false; // session-local; cleared on session end
  return true;
};

/**
 * @param {string} playerId
 * @param {string} situationKey
 * @returns {{leak: object|null, loading: boolean, snooze: () => Promise<void>, dismiss: () => void}}
 */
export const useHeroLeaks = (playerId, situationKey) => {
  const [leak, setLeak] = useState(null);
  const [loading, setLoading] = useState(false);
  const sessionDismissedRef = useRef(new Set()); // session-local dismiss

  useEffect(() => {
    if (!playerId || !situationKey) {
      setLeak(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getLeak(playerId, situationKey)
      .then((record) => {
        if (cancelled) return;
        const dismissKey = `${playerId}/${situationKey}`;
        if (sessionDismissedRef.current.has(dismissKey)) {
          setLeak(null);
        } else {
          setLeak(isLeakActive(record) ? record : null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, situationKey]);

  const snooze = useCallback(async () => {
    if (!playerId || !situationKey) return;
    await snoozeLeak(playerId, situationKey);
    setLeak(null); // Removed from active surface after snooze
  }, [playerId, situationKey]);

  const dismiss = useCallback(() => {
    if (!playerId || !situationKey) return;
    sessionDismissedRef.current.add(`${playerId}/${situationKey}`);
    setLeak(null);
  }, [playerId, situationKey]);

  return { leak, loading, snooze, dismiss };
};
