/**
 * useCitedDecisions.js — Lazy memoized cited-decision computation per assumption
 *
 * Per architecture §3.3 + §6 perf budget: CitedDecision dividend computation has
 * a target ≤30ms / ceiling ≤80ms. Cache structure splits the cost:
 *
 *   - **Baseline computation** (the expensive step — runs gameTreeEvaluator): kicked off
 *     async per assumption.id, memoized in useState. Recomputes only on assumption.id change.
 *   - **CitedDecision composition** (the cheap step — composeOperators + attribution): runs
 *     synchronously in useMemo, recomputes when dial changes (since the assumption record's
 *     operator.currentDial is part of the produceCitedDecision input).
 *
 * Returns:
 *   { citedDecisionsById: { [id]: CitedDecision | { loading: true } | { error: string } },
 *     isAnyLoading: boolean }
 *
 * Honesty check (I-AE-3): when assumption.operator.currentDial = 0, produceCitedDecision
 * short-circuits to `recommendedAction === baselineAction` and `dividend === 0`. The hook
 * just renders what the producer returns — no UI logic needed for the invariant.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  produceCitedDecision,
  computeBaselineForAssumption,
} from '../utils/citedDecision';

// ───────────────────────────────────────────────────────────────────────────
// Hook
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {Array<Object>} assumptions       — VillainAssumption[] to compute citations for
 * @param {Object} villainTendencies        — { [villainId]: VillainTendency }
 * @param {Object} [options={}]
 * @param {Object} [options.gameTreeOpts]   — passed through to computeBaselineForAssumption opts
 * @returns {{
 *   citedDecisionsById: Object<string, Object>,
 *   baselinesById: Object<string, Object>,
 *   isAnyLoading: boolean,
 * }}
 */
export const useCitedDecisions = (assumptions = [], villainTendencies = {}, options = {}) => {
  // baselinesById: { [assumptionId]: { baseline, node, source, reason?, error?, treeMetadata? } }
  const [baselinesById, setBaselinesById] = useState({});

  // Stable list of (id, dialQuant) keys to detect what to compute.
  // We don't include dial here because dial change does NOT invalidate the gameTree baseline;
  // only re-runs the cheap composition step in useMemo below.
  const assumptionIdsKey = useMemo(() => {
    return assumptions.map((a) => a?.id).filter(Boolean).join('|');
  }, [assumptions]);

  // Effect: kick off async baseline computation for any new assumption ids.
  useEffect(() => {
    let cancelled = false;
    const idsNeedingCompute = assumptions.filter(
      (a) => a && a.id && baselinesById[a.id] === undefined,
    );
    if (idsNeedingCompute.length === 0) return undefined;

    // Mark in-flight by setting a sentinel — prevents duplicate fires across renders.
    setBaselinesById((prev) => {
      const next = { ...prev };
      for (const a of idsNeedingCompute) {
        if (next[a.id] === undefined) next[a.id] = { loading: true };
      }
      return next;
    });

    for (const a of idsNeedingCompute) {
      const villainTendency = villainTendencies[a.villainId] ?? { style: 'Unknown' };
      computeBaselineForAssumption({
        assumption: a,
        villainTendency,
        opts: options.gameTreeOpts ?? {},
      }).then((result) => {
        if (cancelled) return;
        setBaselinesById((prev) => ({ ...prev, [a.id]: result }));
      }).catch((err) => {
        if (cancelled) return;
        setBaselinesById((prev) => ({
          ...prev,
          [a.id]: {
            baseline: null,
            node: null,
            reason: 'gameTree-error',
            error: err?.message ?? String(err),
          },
        }));
      });
    }

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assumptionIdsKey]);

  // Derived: cited decisions, recomputed when assumptions / baselines / tendencies change.
  // Dial change flows through `assumptions` (the assumption record's
  // operator.currentDial) so this also re-runs on dial change without baseline recompute.
  const citedDecisionsById = useMemo(() => {
    const out = {};
    for (const a of assumptions) {
      if (!a || !a.id) continue;
      const b = baselinesById[a.id];
      if (b === undefined || b?.loading) {
        out[a.id] = { loading: true };
        continue;
      }
      if (!b.baseline) {
        out[a.id] = { error: b.reason ?? 'unknown', node: b.node, source: b.source };
        continue;
      }
      const villainTendency = villainTendencies[a.villainId] ?? { style: 'Unknown' };
      try {
        const cited = produceCitedDecision({
          node: b.node,
          assumptions: [a],
          baseline: b.baseline,
          options: { surface: 'drill', villainStyle: villainTendency.style },
        });
        // Attach node + source so consumers (DrillReveal) can render the
        // synthesis-disclosure badge.
        out[a.id] = cited
          ? { ...cited, node: b.node, source: b.source }
          : { error: 'producer-returned-null', node: b.node, source: b.source };
      } catch (err) {
        out[a.id] = {
          error: 'producer-error',
          message: err?.message ?? String(err),
          node: b.node,
          source: b.source,
        };
      }
    }
    return out;
  }, [assumptions, baselinesById, villainTendencies]);

  const isAnyLoading = useMemo(
    () => assumptions.some((a) => {
      if (!a || !a.id) return false;
      const b = baselinesById[a.id];
      return b === undefined || b?.loading === true;
    }),
    [assumptions, baselinesById],
  );

  return {
    citedDecisionsById,
    baselinesById,
    isAnyLoading,
  };
};
