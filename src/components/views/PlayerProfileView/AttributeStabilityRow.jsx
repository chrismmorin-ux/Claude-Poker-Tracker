/**
 * @file AttributeStabilityRow — single row in the AttributeStability section.
 * Renders attribute name + current value + posterior% + confidence + sample size + MoE.
 * Per docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md
 * §PIO-G4-S1 + §PIO-G3-STAB.
 *
 * Per AP-PIO-04: factual labels (no shame copy). Confidence labels are
 * descriptive ('always' / 'sometimes' / 'today-only'), not graded.
 *
 * SPR-035 / WS-162 (2026-05-04).
 */

import React from 'react';

const formatValue = (value) => {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.join(', ');
  }
  return String(value);
};

const CONFIDENCE_COLOR = {
  'always': 'text-green-400',
  'sometimes': 'text-yellow-400',
  'today-only': 'text-gray-500',
};

export const AttributeStabilityRow = ({
  attributeKey,
  label,
  stability,
  currentValue,
}) => {
  const { posterior, confidence, moe, sampleSize } = stability;
  const confidenceClass = CONFIDENCE_COLOR[confidence] || 'text-gray-400';
  const posteriorPct = (posterior * 100).toFixed(0);
  const moePct = (moe * 100).toFixed(0);

  return (
    <div
      className="px-2 py-2 flex items-baseline gap-3 text-sm"
      data-testid={`player-profile-stability-row-${attributeKey}`}
    >
      <div className="w-28 text-gray-400 shrink-0">{label}</div>
      <div className="flex-1 text-gray-200 truncate">
        {formatValue(currentValue)}
      </div>
      <div className={`text-xs ${confidenceClass} w-20 text-right shrink-0`}>
        {confidence}
      </div>
      <div className="text-xs text-gray-500 w-32 text-right shrink-0 tabular-nums">
        {posteriorPct}% ±{moePct}% (n={sampleSize})
      </div>
    </div>
  );
};
