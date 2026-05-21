/**
 * @file EquityDistributionCurveSection — SLS Stream B2 surface embed.
 *
 * Renders inside HandReplayView's ReviewPanel between the Range
 * Silhouette row and the Spire + Polarization row. Active only on
 * hero-action steps with a computable per-combo equity distribution
 * (`perCombo`); transforms that distribution into the sorted
 * villain-equity curve and renders the curve + weighted mean + combo
 * count as a read-only descriptor row.
 *
 * Spec: WS-042 / SPR-084. Stream B2 of the Shape Language System.
 * Plan-mode decisions (A1, B2, C1) ratified 2026-05-16:
 *   A1 = EDC → Spire/Polarization → Sizing Tag ship order
 *   B2 = `shapeDescriptors/` namespace
 *   C1 = `shapeLanguage/` may import data producers from `exploitEngine/`,
 *        but the SECTION takes pre-computed `perCombo` as a prop so the
 *        section component itself stays cross-domain-clean.
 *
 * IMPORTANT — current data flow status: the `perCombo` prop is not
 * yet wired in ReviewPanel because `villainAnalysis` does not (yet)
 * expose a per-combo equity distribution. The section renders null
 * until a follow-up sprint plumbs `perCombo` through the analysis
 * pipeline (likely as part of HandReplay's existing analysis hook). The
 * classifier + lesson + tests are real and exercised with synthetic
 * `perCombo` data; visible-on-screen impact unlocks when wiring lands.
 *
 * Anti-pattern refused (HARD GUARDRAIL): the curve descriptor is
 * presentation-only. It is NEVER read back as an input to villain
 * modeling, exploit generation, or any decision-driving computation.
 * Per `feedback_first_principles_decisions.md` + POKER_THEORY.md §7 +
 * `src/utils/shapeLanguage/CLAUDE.md` §Cross-domain import rule.
 *
 * Autonomy red lines (chris-live-player.md):
 *   #5 — no shame / engagement-pressure copy. Display is factual
 *        curve + numeric weighted-mean + combo count.
 *   #8 — no cross-surface contamination. Renders ONLY inside
 *        HandReplayView (review-mode).
 *   #9 — mastery never displayed as a score. The "mean equity"
 *        readout is a property of the range, not a user-mastery score.
 *
 * No writes. No dispatches. No IDB. No shapeMastery interaction.
 */

import React, { useMemo, useState } from 'react';
import { computeEquityDistributionCurve } from '../../../utils/shapeLanguage';

const SVG_WIDTH = 240;
const SVG_HEIGHT = 60;
const SVG_PAD = 4;

export const EquityDistributionCurveSection = ({ perCombo = null }) => {
  const [collapsed, setCollapsed] = useState(false);

  const curve = useMemo(() => {
    if (!perCombo) return null;
    return computeEquityDistributionCurve(perCombo);
  }, [perCombo]);

  // Suppress entirely when no curve data is available, or when the
  // sparse-input guard fired.
  if (!curve || curve.status === 'empty') return null;

  return (
    <div
      className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-2 space-y-2"
      data-testid="equity-distribution-curve-section"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full text-left flex justify-between items-center"
        aria-expanded={!collapsed}
        aria-controls="equity-distribution-curve-section-body"
      >
        <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
          Equity-Distribution Curve
        </span>
        <span className="text-gray-500 text-[10px]" aria-hidden>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>
      {!collapsed && (
        <div id="equity-distribution-curve-section-body" className="space-y-2">
          <CurveStats curve={curve} />
          <CurvePath curve={curve} />
        </div>
      )}
    </div>
  );
};

// ─── Stats line ──────────────────────────────────────────────────────

const CurveStats = ({ curve }) => (
  <div
    className="text-white text-sm flex items-center gap-3"
    data-testid="equity-distribution-curve-stats"
  >
    <span data-testid="equity-distribution-curve-mean">
      mean equity {(curve.weightedMean * 100).toFixed(0)}%
    </span>
    <span className="text-gray-500 text-[11px]">
      {curve.combosTotal} combo{curve.combosTotal === 1 ? '' : 's'}
    </span>
    <span
      className="text-gray-500 text-[11px]"
      data-testid="equity-distribution-curve-weight"
    >
      weight {curve.totalWeight.toFixed(1)}
    </span>
  </div>
);

// ─── Sorted-equity SVG line ──────────────────────────────────────────

const CurvePath = ({ curve }) => {
  const { sortedEquities, percentiles } = curve;
  if (sortedEquities.length === 0) return null;

  // Map (percentile, equity) → SVG path. percentile is x in [0, 1],
  // equity is y in [0, 1] (inverted so high equity = top of plot).
  const innerW = SVG_WIDTH - 2 * SVG_PAD;
  const innerH = SVG_HEIGHT - 2 * SVG_PAD;
  const points = sortedEquities.map((eq, i) => {
    const pct = percentiles[i];
    const x = SVG_PAD + pct * innerW;
    const y = SVG_PAD + (1 - eq) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="w-full h-12"
      data-testid="equity-distribution-curve-path"
      aria-label="Equity distribution curve — sorted villain equity by cumulative weight"
      role="img"
    >
      <rect
        x={0}
        y={0}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        fill="rgba(6, 78, 59, 0.4)"
      />
      <line
        x1={SVG_PAD}
        y1={SVG_PAD + 0.5 * (SVG_HEIGHT - 2 * SVG_PAD)}
        x2={SVG_WIDTH - SVG_PAD}
        y2={SVG_PAD + 0.5 * (SVG_HEIGHT - 2 * SVG_PAD)}
        stroke="rgba(156, 163, 175, 0.3)"
        strokeWidth={0.5}
        strokeDasharray="2 2"
      />
      <path
        d={pathD}
        stroke="rgba(110, 231, 183, 0.95)"
        strokeWidth={1.5}
        fill="none"
      />
    </svg>
  );
};
