/**
 * @file SizingCurveTagSection — SLS Stream B2 surface embed.
 *
 * Renders inside HandReplayView's ReviewPanel beneath the Spire +
 * Polarization row. Active only on hero-action steps with a
 * computable EV-by-sizing array (`evByFraction`); classifies the
 * curve into Ridge / Plateau / Cliff / Ramp (or compound) and
 * renders the tag label + thumbnail curve.
 *
 * Spec: WS-042 / SPR-084. Stream B2 of the Shape Language System.
 * Plan-mode decisions (A1, B2, C1) ratified 2026-05-16.
 *
 * IMPORTANT — current data flow status: the `evByFraction` prop is
 * not yet wired in ReviewPanel because the game-tree EV-by-sizing
 * output is not (yet) exposed in `villainAnalysis` for the review
 * surface. The section renders null until a follow-up sprint plumbs
 * the array through. The classifier + lesson + tests are real and
 * exercised with synthetic data; visible-on-screen impact unlocks
 * when wiring lands.
 *
 * Anti-pattern refused (HARD GUARDRAIL): the sizing-curve tag
 * rendered here is presentation-only. It is NEVER read back as an
 * input to hero-action selection or sizing recommendation. Hero
 * sizing comes from the game-tree evaluator, not this classifier.
 * Per `feedback_first_principles_decisions.md` + POKER_THEORY.md §7
 * + `src/utils/shapeLanguage/CLAUDE.md`.
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
  classifySizingCurveTag,
  getSizingCurveTagDisplayName,
  SIZING_CURVE_LABELS,
} from '../../../utils/shapeLanguage';

const THUMB_WIDTH = 200;
const THUMB_HEIGHT = 48;
const THUMB_PAD = 4;

export const SizingCurveTagSection = ({ evByFraction = null }) => {
  const [collapsed, setCollapsed] = useState(false);

  const tag = useMemo(() => {
    if (!evByFraction) return null;
    return classifySizingCurveTag(evByFraction);
  }, [evByFraction]);

  if (!tag || tag.label === 'empty') return null;

  return (
    <div
      className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-2 space-y-2"
      data-testid="sizing-curve-tag-section"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full text-left flex justify-between items-center"
        aria-expanded={!collapsed}
        aria-controls="sizing-curve-tag-section-body"
      >
        <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
          Sizing Curve Tag
        </span>
        <span className="text-gray-500 text-[10px]" aria-hidden>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>
      {!collapsed && (
        <div id="sizing-curve-tag-section-body" className="space-y-2">
          <LabelLine tag={tag} />
          <PrototypeScoreBar prototypeScores={tag.prototypeScores} />
          <ThumbCurve evByFraction={evByFraction} peakIndex={tag.peakIndex} />
        </div>
      )}
    </div>
  );
};

// ─── Label line ──────────────────────────────────────────────────────

const LabelLine = ({ tag }) => {
  const { label, confidence, components, peakEV } = tag;
  const isCompound = label === 'compound' && components;
  const displayLabel = isCompound
    ? `${getSizingCurveTagDisplayName(components[0])} / ${getSizingCurveTagDisplayName(components[1])}`
    : getSizingCurveTagDisplayName(label);
  return (
    <div
      className="text-white text-sm flex items-center gap-2"
      data-testid="sizing-curve-tag-label"
    >
      <span className="font-semibold">{displayLabel}</span>
      <span
        className="text-gray-500 text-[11px]"
        data-testid="sizing-curve-tag-confidence"
      >
        confidence {(confidence * 100).toFixed(0)}%
      </span>
      <span className="text-gray-500 text-[11px]">
        peak EV {peakEV.toFixed(2)}
      </span>
    </div>
  );
};

// ─── Per-prototype score bar ─────────────────────────────────────────

const PrototypeScoreBar = ({ prototypeScores }) => (
  <div
    className="flex gap-1 text-[10px]"
    data-testid="sizing-curve-tag-score-bar"
  >
    {SIZING_CURVE_LABELS.map((proto) => {
      const score = prototypeScores[proto] ?? 0;
      const widthPct = Math.max(2, Math.round(score * 100));
      return (
        <div key={proto} className="flex-1 flex flex-col items-center">
          <div className="w-full h-1 bg-gray-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-emerald-500/70"
              style={{ width: `${widthPct}%` }}
              data-testid={`sizing-curve-tag-score-${proto}`}
            />
          </div>
          <span className="text-gray-500 text-[9px] mt-1">
            {getSizingCurveTagDisplayName(proto)}
          </span>
        </div>
      );
    })}
  </div>
);

// ─── Thumbnail curve ─────────────────────────────────────────────────

const ThumbCurve = ({ evByFraction, peakIndex }) => {
  if (!Array.isArray(evByFraction) || evByFraction.length === 0) return null;
  const sorted = evByFraction
    .filter((e) => e && Number.isFinite(e.fraction) && Number.isFinite(e.ev))
    .slice()
    .sort((a, b) => a.fraction - b.fraction);
  if (sorted.length < 2) return null;

  const minFrac = sorted[0].fraction;
  const maxFrac = sorted[sorted.length - 1].fraction;
  const fracSpan = Math.max(maxFrac - minFrac, 1e-9);
  const evMin = Math.min(...sorted.map((e) => e.ev));
  const evMax = Math.max(...sorted.map((e) => e.ev));
  const evSpan = Math.max(evMax - evMin, 1e-9);

  const innerW = THUMB_WIDTH - 2 * THUMB_PAD;
  const innerH = THUMB_HEIGHT - 2 * THUMB_PAD;
  const points = sorted.map((e) => {
    const x = THUMB_PAD + ((e.fraction - minFrac) / fracSpan) * innerW;
    const y = THUMB_PAD + (1 - (e.ev - evMin) / evSpan) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg
      viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
      className="w-full h-10"
      data-testid="sizing-curve-tag-thumb"
      aria-label="EV-vs-sizing thumbnail curve"
      role="img"
    >
      <rect
        x={0}
        y={0}
        width={THUMB_WIDTH}
        height={THUMB_HEIGHT}
        fill="rgba(6, 78, 59, 0.4)"
      />
      <path
        d={pathD}
        stroke="rgba(110, 231, 183, 0.95)"
        strokeWidth={1.5}
        fill="none"
      />
      {peakIndex !== null && peakIndex >= 0 && peakIndex < sorted.length && (
        <circle
          cx={THUMB_PAD + ((sorted[peakIndex].fraction - minFrac) / fracSpan) * innerW}
          cy={THUMB_PAD + (1 - (sorted[peakIndex].ev - evMin) / evSpan) * innerH}
          r={2.5}
          fill="rgba(250, 204, 21, 0.95)"
          data-testid="sizing-curve-tag-thumb-peak"
        />
      )}
    </svg>
  );
};
