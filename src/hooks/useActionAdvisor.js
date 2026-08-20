/**
 * useActionAdvisor.js - React hook for on-demand exploit engine analysis
 *
 * Used in PlayerAnalysisPanel for manual "what-if" analysis: user selects
 * a villain, enters board + hero cards, and triggers analysis on demand.
 *
 * This is DISTINCT from useLiveActionAdvisor, which runs automatically
 * during live Ignition play via the extension's hand state feed.
 *
 * @see useLiveActionAdvisor — automatic, live-play analysis in OnlineAnalysisContext
 */

import { useState, useCallback } from 'react';
import { evaluateGameTree } from '../utils/exploitEngine/gameTreeEvaluator';
import { parseAndEncode } from '../utils/pokerCore/cardParser';
import { useAbortControl } from './useAbortControl';

/**
 * @returns {{ advice: object|null, isComputing: boolean, error: string|null, compute: Function, clear: Function }}
 */
export const useActionAdvisor = () => {
  const [advice, setAdvice] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState(null);
  const { register, isCurrent, abort } = useAbortControl();

  const compute = useCallback(async ({
    villainRange,
    boardCards,
    heroCardStrings,
    potSize,
    villainAction,
    villainBet = 0,
    playerStats,
    villainModel,
    trials = 2000,
    // WS-333 follow-up: this advisor serves the MANUAL live table — the founder's actual
    // 1/2 game — and never passed a rake config, so `evaluateGameTree` defaulted it to null
    // and every EV figure omitted a $5-8 drop out of a pot often only $40. Resolve it with
    // `rakeResolver.resolveRakeConfig` from the active session and pass it here.
    rakeConfig = null,
  }) => {
    const callId = register();
    setIsComputing(true);
    setError(null);

    try {
      // Convert card strings to encoded ints
      const heroCards = heroCardStrings.map(parseAndEncode).filter(c => c >= 0);
      if (heroCards.length !== 2) {
        throw new Error('Exactly 2 valid hero cards required');
      }

      const board = boardCards.map(parseAndEncode).filter(c => c >= 0);
      if (board.length < 3) {
        throw new Error('At least 3 board cards required');
      }

      // WS-574: the fast (depth-1) action, captured so the refined answer can say whether it
      // CHANGED the recommendation rather than swapping under the founder's eyes. WS-496
      // measured depth-2 flipping the top action on 35.3% of flops — the common case.
      // `assembleResult` sorts both phases with the same comparator, so [0] is comparable.
      let fastTopAction = null;

      const { treeMetadata, ...result } = await evaluateGameTree({
        villainRange,
        board,
        heroCards,
        potSize,
        villainAction: villainAction || undefined,
        villainBet,
        playerStats,
        villainModel,
        trials,
        rakeConfig,
        // WS-574: `evaluateGameTree` has been two-phase since WS-334 and NO production caller
        // ever passed this, so the depth-1 answer was computed, discarded, and the founder
        // waited for the whole refinement anyway. That inert fast path is why
        // `refinementBudgetMs` was pinned at a table-latency floor of 2000 — and at 2000,
        // depth-2 never once finished (mean runout coverage 0.380, barrel planning gated on
        // every board). Wiring this is what lets the budget rise.
        onFastResult: (fast) => {
          // Same staleness guard as the refined path: a fast result from a superseded call
          // must never overwrite a newer one.
          if (!isCurrent(callId)) return;
          const { treeMetadata: _fastMeta, ...fastAdvice } = fast;
          fastTopAction = fastAdvice.recommendations?.[0]?.action ?? null;
          setAdvice({ ...fastAdvice, isProvisional: true, changedOnRefine: null });
        },
      });

      // Only update if this is still the latest call
      if (isCurrent(callId)) {
        const refinedTopAction = result.recommendations?.[0]?.action ?? null;
        setAdvice({
          ...result,
          isProvisional: false,
          // The action the fast answer recommended, IF refinement moved off it. null means
          // "nothing to report" — either it agreed, or there was no fast phase to compare.
          changedOnRefine: (fastTopAction && refinedTopAction && fastTopAction !== refinedTopAction)
            ? fastTopAction
            : null,
        });
      }
    } catch (err) {
      if (isCurrent(callId)) {
        setError(err.message);
        setAdvice(null);
      }
    } finally {
      if (isCurrent(callId)) {
        setIsComputing(false);
      }
    }
  }, [register, isCurrent]);

  const clear = useCallback(() => {
    abort();
    setAdvice(null);
    setError(null);
    setIsComputing(false);
  }, [abort]);

  return { advice, isComputing, error, compute, clear };
};
