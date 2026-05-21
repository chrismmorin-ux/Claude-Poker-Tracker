/**
 * @file SaddleSection — SLS Stream B3 surface embed.
 *
 * Renders inside HandReplayView's ReviewPanel after the Sizing Curve
 * Tag row. Active only on hero-action steps with a computable per-combo
 * equity distribution (`perCombo`); classifies the villain's range into
 * Saddle space and renders the two-mass breakdown plus the rollup label.
 *
 * Spec: WS-043 / SPR-088. Stream B3 of the Shape Language System.
 *
 * The PRIMARY signal rendered here is the two masses ({wayAheadMass,
 * wayBehindMass}). The label is a derived rollup; per
 * INV-SLS-B3-SADDLE-TWO-MASS, surfaces should not hide the underlying
 * masses behind the label alone. Both percentages render in the
 * always-visible label line; the collapse toggle hides the body but
 * the header still carries the label badge.
 *
 * Anti-pattern refused (HARD GUARDRAIL): the wayAheadMass / wayBehindMass
 * / label are presentation-only. They are NEVER read back as inputs to
 * villain modeling, exploit generation, or any decision-driving
 * computation. Per `feedback_first_principles_decisions.md` +
 * POKER_THEORY.md §7 + `src/utils/shapeLanguage/CLAUDE.md`.
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
  classifySaddle,
  getSaddleDisplayName,
} from '../../../utils/shapeLanguage';

export const SaddleSection = ({ perCombo = null }) => {
  const [collapsed, setCollapsed] = useState(false);

  const classification = useMemo(() => {
    if (!perCombo) return null;
    return classifySaddle(perCombo);
  }, [perCombo]);

  if (!classification || classification.label === 'empty') return null;

  return (
    <div
      className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-2 space-y-2"
      data-testid="saddle-section"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full text-left flex justify-between items-center"
        aria-expanded={!collapsed}
        aria-controls="saddle-section-body"
      >
        <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
          Way-Ahead / Way-Behind
        </span>
        <span className="text-gray-500 text-[10px]" aria-hidden>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>
      {!collapsed && (
        <div id="saddle-section-body" className="space-y-2">
          <LabelLine classification={classification} />
          <MassBars classification={classification} />
        </div>
      )}
    </div>
  );
};

// ─── Label + masses line ────────────────────────────────────────────

const LabelLine = ({ classification }) => {
  const wayAheadPct = Math.round(classification.wayAheadMass * 100);
  const wayBehindPct = Math.round(classification.wayBehindMass * 100);
  return (
    <div
      className="text-white text-sm flex items-center gap-2 flex-wrap"
      data-testid="saddle-label"
    >
      <span className="font-semibold">
        {getSaddleDisplayName(classification.label)}
      </span>
      <span
        className="text-gray-400 text-[11px]"
        data-testid="saddle-mass-summary"
      >
        WA {wayAheadPct}% • WB {wayBehindPct}%
      </span>
    </div>
  );
};

// ─── Two-mass horizontal bar ────────────────────────────────────────
//
// Single horizontal track. Way-ahead mass anchored left, way-behind
// mass anchored right, middle (derived) sits between them with a
// muted shade. The relative widths are the masses themselves; widths
// always sum to 100% by INV-SLS-B3 (wayAhead + wayBehind + middle = 1).

const MassBars = ({ classification }) => {
  const waPct = classification.wayAheadMass * 100;
  const wbPct = classification.wayBehindMass * 100;
  const middlePct = Math.max(0, 100 - waPct - wbPct);
  return (
    <div
      className="flex w-full h-3 rounded-sm overflow-hidden"
      data-testid="saddle-mass-bar"
      aria-label={`Villain way-ahead-mass ${waPct.toFixed(0)} percent, way-behind-mass ${wbPct.toFixed(0)} percent, middle ${middlePct.toFixed(0)} percent`}
    >
      <div
        className="bg-red-500/70 h-full"
        style={{ width: `${waPct}%` }}
        data-testid="saddle-mass-bar-wayAhead"
        title={`Way-ahead (villain beats hero): ${waPct.toFixed(0)}%`}
      />
      <div
        className="bg-gray-600/40 h-full"
        style={{ width: `${middlePct}%` }}
        data-testid="saddle-mass-bar-middle"
        title={`Middle (close decision): ${middlePct.toFixed(0)}%`}
      />
      <div
        className="bg-emerald-500/70 h-full"
        style={{ width: `${wbPct}%` }}
        data-testid="saddle-mass-bar-wayBehind"
        title={`Way-behind (hero beats villain): ${wbPct.toFixed(0)}%`}
      />
    </div>
  );
};
