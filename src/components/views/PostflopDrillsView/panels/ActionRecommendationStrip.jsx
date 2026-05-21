/**
 * ActionRecommendationStrip (P4) — thin 1-line summary of the correct
 * action + why.
 *
 * Per the v2 spec: P4 is a skip-safe summary, not the carrier of the
 * teaching payload. For V5 bluff-catch and V6 thin-value, the pedagogical
 * insight is rendered structurally in P1's polar-split modes; P4 is the
 * fast-path read-out for the impatient reader.
 *
 * Authored-vs-templated resolution (per spec):
 *   - Renderer prefers `authoredReason` when present.
 *   - Falls back to `templatedReason` otherwise.
 *   - Dev-mode warns when both present (suggests authoring drift).
 */

import React, { useEffect } from 'react';
import { formatPercentGroup } from '../../../../utils/pokerCore/percentGroup';

export const ActionRecommendationStrip = ({ recommendation, valueBeatRatio = null }) => {
  const authored = recommendation?.authoredReason;
  const templated = recommendation?.templatedReason;
  const actionLabel = recommendation?.actionLabel || '';

  useEffect(() => {
    if (authored && templated && typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[ActionRecommendationStrip] both authoredReason and templatedReason present — '
        + 'preferring authored; remove templated if intentional'
      );
    }
  }, [authored, templated]);

  const reason = authored || templated;
  if (!actionLabel && !reason) return null;

  // 2-value partition: value-region weight vs bluff-or-pay-region weight,
  // sums to 100% of the relevant villain range slice. WS-185.
  // Note: 2-value display intentionally renders without the "(sums to 100%)"
  // inline label per plan — the ratio reads cleanly without the annotation
  // and the label would dominate this thin one-line strip.
  const [valuePct, bluffPayPct] = valueBeatRatio && Number.isFinite(valueBeatRatio.ratio)
    ? formatPercentGroup(
        [valueBeatRatio.valueWeight, valueBeatRatio.bluffOrPayWeight],
        1,
      )
    : [null, null];

  return (
    <div className="rounded-md border border-teal-700/60 bg-teal-950/40 px-3 py-2">
      <div className="text-[11px] text-teal-100 leading-snug">
        {reason || `Correct: ${actionLabel}`}
      </div>
      {valueBeatRatio && Number.isFinite(valueBeatRatio.ratio) && (
        <div className="text-[10px] text-gray-400 mt-1 font-mono">
          value:bluff-or-pay ratio ≈{' '}
          <span data-testid="ars-pct-value">{valuePct}%</span>
          {' : '}
          <span data-testid="ars-pct-bluff-or-pay">{bluffPayPct}%</span>
          {valueBeatRatio.bluffOrPayWeight > 0
            ? ` (${valueBeatRatio.ratio.toFixed(2)}×)`
            : ' (no opposing region)'}
        </div>
      )}
    </div>
  );
};
