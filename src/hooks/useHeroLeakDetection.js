/**
 * @file useHeroLeakDetection — React hook that runs the SCF hero-leak
 * detector end-to-end against IDB hand history.
 *
 * Trigger: on mount + when userId changes. Skips re-detection if hand
 * count is unchanged since the last successful run (mirrors the
 * usePlayerTendencies count-cache pattern).
 *
 * Per src/utils/skillAssessment/CLAUDE.md source-util-policy whitelist:
 *   This hook MUST only be imported from HandReplayView (review-mode) or
 *   SelfCoachView. Live-table surfaces are blacklisted per
 *   chris-live-player.md autonomy red line #8.
 *
 * SPR-031 / WS-158 (2026-05-03).
 */

import { useEffect, useRef, useState } from 'react';
import { runHeroLeakDetection } from '../utils/skillAssessment/heroLeakDetectionPipeline';
import { getHandCount, GUEST_USER_ID } from '../utils/persistence/index';

/**
 * @param {string} [userId=GUEST_USER_ID] - Auth-scoped user id.
 * @param {object} [options]
 * @param {function} [options.runDetection] - Override (test injection)
 * @param {function} [options.countHands] - Override (test injection)
 * @returns {{detecting: boolean, lastRunCount: number, lastRunAt: number|null, error: string|null, firedLeaks: Array, heroSeat: number|null}}
 */
export const useHeroLeakDetection = (userId = GUEST_USER_ID, options = {}) => {
  const [state, setState] = useState({
    detecting: false,
    lastRunCount: 0,
    lastRunAt: null,
    error: null,
    firedLeaks: [],
    heroSeat: null,
  });
  const lastCountRef = useRef(0);

  const runDetectionFn = options.runDetection || runHeroLeakDetection;
  const countHandsFn = options.countHands || getHandCount;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const currentCount = await countHandsFn(userId);
        if (cancelled) return;
        if (currentCount === lastCountRef.current && currentCount > 0) {
          // Skip — hand count unchanged since last run.
          return;
        }
        setState((s) => ({ ...s, detecting: true, error: null }));
        const result = await runDetectionFn(userId);
        if (cancelled) return;
        lastCountRef.current = currentCount;
        setState({
          detecting: false,
          lastRunCount: currentCount,
          lastRunAt: Date.now(),
          error: null,
          firedLeaks: result.firedLeaks || [],
          heroSeat: result.heroSeat || null,
        });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, detecting: false, error: err.message || 'Detection failed' }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return state;
};
