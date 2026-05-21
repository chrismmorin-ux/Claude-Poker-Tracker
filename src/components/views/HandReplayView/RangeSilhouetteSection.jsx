/**
 * @file RangeSilhouetteSection — first SLS surface embed.
 *
 * Renders inside HandReplayView's ReviewPanel between HeroStateSection
 * and VillainAnalysisSection. Active only on hero-action steps with a
 * computable villain range; classifies that 169-cell preflop range into
 * one of 5 silhouette prototypes (Oval / Barbell / Triangle / Comb /
 * Cloud) and renders the label + confidence + per-prototype score bar.
 *
 * Spec: WS-041 / SPR-082. Stream B1 of the Shape Language System.
 * Plan-mode decisions (D1, D3) ratified 2026-05-15:
 *   D1 = discriminated-union output enum (label/components/confidence/scores/features)
 *   D3 = read-only descriptor row, villain range only, mirrors HeroStateSection pattern
 *
 * Anti-pattern refused (HARD GUARDRAIL): the silhouette label rendered
 * here is presentation-only. It is NEVER read back as an input to
 * villain modeling, exploit generation, or any decision-driving
 * computation. Per `feedback_first_principles_decisions.md` +
 * POKER_THEORY.md §7 + `src/utils/shapeLanguage/CLAUDE.md`.
 *
 * Autonomy red lines (chris-live-player.md):
 *   #5 — no shame / engagement-pressure copy. Display is factual labels
 *        + numeric confidence. Forbidden-string grep in tests.
 *   #8 — no cross-surface contamination. This component renders ONLY
 *        inside HandReplayView (review-mode); imports check enforces.
 *   #9 — mastery never displayed as a score. Confidence is the
 *        classifier's prototype-probability, not a user mastery score.
 *
 * No writes. No dispatches. No IDB. No shapeMastery interaction.
 */

import React, { useMemo, useState } from 'react';
import {
  classifySilhouette,
  getSilhouetteDisplayName,
  getSilhouetteMorphology,
  SILHOUETTE_LABELS,
} from '../../../utils/shapeLanguage';

export const RangeSilhouetteSection = ({ villainRange = null }) => {
  const [collapsed, setCollapsed] = useState(false);

  const classification = useMemo(() => {
    if (!villainRange) return null;
    return classifySilhouette(villainRange);
  }, [villainRange]);

  // Suppress the embed entirely when there's no range to classify, or
  // when the classifier returned 'empty' (per the sparse-input guard).
  if (!classification || classification.label === 'empty') return null;

  return (
    <div
      className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-2 space-y-2"
      data-testid="range-silhouette-section"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full text-left flex justify-between items-center"
        aria-expanded={!collapsed}
        aria-controls="range-silhouette-section-body"
      >
        <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
          Range Silhouette
        </span>
        <span className="text-gray-500 text-[10px]" aria-hidden>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>
      {!collapsed && (
        <div id="range-silhouette-section-body" className="space-y-2">
          <LabelLine classification={classification} />
          <PrototypeScoreBar prototypeScores={classification.prototypeScores} />
        </div>
      )}
    </div>
  );
};

// ─── Label rendering ─────────────────────────────────────────────────

const LabelLine = ({ classification }) => {
  const { label, confidence, components } = classification;
  if (label === 'compound' && components) {
    const [c1, c2] = components;
    const m1 = getSilhouetteMorphology(c1);
    const m2 = getSilhouetteMorphology(c2);
    return (
      <div data-testid="range-silhouette-label" className="text-white text-sm">
        <span className="font-semibold">
          {getSilhouetteDisplayName(c1)} / {getSilhouetteDisplayName(c2)}
        </span>
        <span className="text-gray-400 text-[11px] ml-2">
          ({m1} / {m2})
        </span>
        <span
          className="text-gray-500 text-[11px] ml-2"
          data-testid="range-silhouette-confidence"
        >
          confidence {(confidence * 100).toFixed(0)}%
        </span>
      </div>
    );
  }
  const morphology = getSilhouetteMorphology(label);
  return (
    <div data-testid="range-silhouette-label" className="text-white text-sm">
      <span className="font-semibold">{getSilhouetteDisplayName(label)}</span>
      {morphology && (
        <span className="text-gray-400 text-[11px] ml-2">({morphology})</span>
      )}
      <span
        className="text-gray-500 text-[11px] ml-2"
        data-testid="range-silhouette-confidence"
      >
        confidence {(confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
};

// ─── Per-prototype score bar ─────────────────────────────────────────

const PrototypeScoreBar = ({ prototypeScores }) => (
  <div
    className="flex gap-1 text-[10px]"
    data-testid="range-silhouette-score-bar"
  >
    {SILHOUETTE_LABELS.map((proto) => {
      const score = prototypeScores[proto] ?? 0;
      const widthPct = Math.max(2, Math.round(score * 100));
      return (
        <div key={proto} className="flex-1 flex flex-col items-center">
          <div className="w-full h-1 bg-gray-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-emerald-500/70"
              style={{ width: `${widthPct}%` }}
              data-testid={`range-silhouette-score-${proto}`}
            />
          </div>
          <span className="text-gray-500 text-[9px] mt-1">
            {getSilhouetteDisplayName(proto)}
          </span>
        </div>
      );
    })}
  </div>
);
