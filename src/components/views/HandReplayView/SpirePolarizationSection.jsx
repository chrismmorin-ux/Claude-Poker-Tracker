/**
 * @file SpirePolarizationSection — SLS Stream B2 surface embed.
 *
 * Renders inside HandReplayView's ReviewPanel between the Equity-
 * Distribution Curve row and the Sizing Curve Tag row. Active only on
 * hero-action steps with a computable per-combo equity distribution
 * (`perCombo`); chains EDC → classifyEquityShape and renders the
 * polarization label + Spire chip + 8-bucket histogram bar.
 *
 * Spec: WS-042 / SPR-084. Stream B2 of the Shape Language System.
 * Plan-mode decisions (A1, B2, C1) ratified 2026-05-16.
 *
 * IMPORTANT — current data flow status: the `perCombo` prop is not
 * yet wired in ReviewPanel because `villainAnalysis` does not (yet)
 * expose a per-combo equity distribution. The section renders null
 * until a follow-up sprint plumbs `perCombo` through the analysis
 * pipeline. The classifier + lesson + tests are real and exercised
 * with synthetic `perCombo` data; visible-on-screen impact unlocks
 * when wiring lands.
 *
 * Anti-pattern refused (HARD GUARDRAIL): the polarization label +
 * hasSpire flag rendered here are presentation-only. They are NEVER
 * read back as inputs to villain modeling, exploit generation, or any
 * decision-driving computation. Per
 * `feedback_first_principles_decisions.md` + POKER_THEORY.md §7 +
 * `src/utils/shapeLanguage/CLAUDE.md`.
 *
 * Autonomy red lines (chris-live-player.md):
 *   #5 — no shame / engagement-pressure copy.
 *   #8 — no cross-surface contamination.
 *   #9 — no mastery-as-score.
 *
 * No writes. No dispatches. No IDB. No shapeMastery interaction.
 */

import React, { useMemo, useState } from 'react';
import {
  computeEquityDistributionCurve,
  classifyEquityShape,
  getPolarizationDisplayName,
} from '../../../utils/shapeLanguage';

export const SpirePolarizationSection = ({ perCombo = null }) => {
  const [collapsed, setCollapsed] = useState(false);

  const shape = useMemo(() => {
    if (!perCombo) return null;
    const curve = computeEquityDistributionCurve(perCombo);
    return classifyEquityShape(curve);
  }, [perCombo]);

  if (!shape || shape.status === 'empty') return null;

  return (
    <div
      className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-2 space-y-2"
      data-testid="spire-polarization-section"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full text-left flex justify-between items-center"
        aria-expanded={!collapsed}
        aria-controls="spire-polarization-section-body"
      >
        <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
          Spire + Polarization
        </span>
        <span className="text-gray-500 text-[10px]" aria-hidden>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>
      {!collapsed && (
        <div id="spire-polarization-section-body" className="space-y-2">
          <LabelLine shape={shape} />
          <PolarizationBar bucketHistogram={shape.bucketHistogram} />
        </div>
      )}
    </div>
  );
};

// ─── Label + Spire chip ─────────────────────────────────────────────

const LabelLine = ({ shape }) => (
  <div
    className="text-white text-sm flex items-center gap-2"
    data-testid="spire-polarization-label"
  >
    <span className="font-semibold">
      {getPolarizationDisplayName(shape.polarization)}
    </span>
    {shape.hasSpire ? (
      <span
        className="px-1.5 py-0.5 rounded bg-emerald-600/60 text-[10px] font-semibold uppercase tracking-wide"
        data-testid="spire-polarization-spire-chip"
        title={`Spire width ${shape.spireWidth} — top bucket carries ${(shape.topBucketFraction * 100).toFixed(0)}% of weight`}
      >
        Spire ×{shape.spireWidth}
      </span>
    ) : (
      <span
        className="px-1.5 py-0.5 rounded bg-gray-700/60 text-[10px] font-semibold uppercase tracking-wide text-gray-400"
        data-testid="spire-polarization-spire-chip"
      >
        No spire
      </span>
    )}
  </div>
);

// ─── 8-bucket histogram bar ─────────────────────────────────────────

const PolarizationBar = ({ bucketHistogram }) => {
  const maxBucket = Math.max(...bucketHistogram, 0.001);
  return (
    <div
      className="flex gap-0.5 items-end h-8"
      data-testid="spire-polarization-bucket-bar"
      aria-label="Villain equity distribution across 8 buckets"
    >
      {bucketHistogram.map((fraction, idx) => {
        const heightPct = Math.max(4, Math.round((fraction / maxBucket) * 100));
        return (
          <div
            key={idx}
            className="flex-1 flex flex-col items-stretch justify-end"
            data-testid={`spire-polarization-bucket-${idx}`}
          >
            <div
              className="bg-emerald-500/70 rounded-sm"
              style={{ height: `${heightPct}%` }}
              title={`Bucket ${idx} (equity ${(idx / 8 * 100).toFixed(0)}-${((idx + 1) / 8 * 100).toFixed(0)}%): ${(fraction * 100).toFixed(0)}% of weight`}
            />
          </div>
        );
      })}
    </div>
  );
};
