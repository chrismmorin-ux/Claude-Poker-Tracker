/**
 * DrillReveal.jsx — Reveal surface with citation + dial + expand control
 *
 * Per surface spec §Anatomy Mode 2 (reveal sub-state) and Mode 2-continued (expanded).
 *
 * Commit 11 (Session 18): real action labels + real dividend from `citedDecision` prop.
 *   - When citedDecision is loading → show skeleton.
 *   - When citedDecision is errored (gameTree timeout / empty / error) → label "compute timed out — try again or skip"
 *     per surface spec §Edge Cases line 338.
 *   - When citedDecision is ready → render baselineAction / recommendedAction / dividend
 *     directly from the producer output. No more heuristic inferers.
 *
 * Honesty check (I-AE-3): when dial=0, produceCitedDecision short-circuits to
 *   recommendedAction === baselineAction and dividend === 0. The UI just renders
 *   what the producer returned — invariant holds structurally.
 *
 * Synthesis disclosure: when citedDecision.source === 'synthesized', renders
 *   "Representative spot · {street} · {texture} · {position}" badge so hero
 *   knows the EVs are computed against a constructed example, not their actual
 *   game state.
 *
 * v1 ships:
 *   - Real labels + real dividend
 *   - Loading + error states
 *   - Synthesis disclosure
 *   - Compact citation line (single-line summary)
 *   - Expandable three-line citation with emotional-state readout
 *   - Discrete dial buttons (0 / 0.3 / 0.6 / 0.9 / 1.0) — slider is v1.5
 *   - Contestability hint ("Try lower dial → baseline re-emerges")
 */

import React, { useState } from 'react';

const DIAL_STEPS = [
  { value: 0, label: '0', desc: 'Balanced' },
  { value: 0.3, label: '0.3', desc: 'Floor' },
  { value: 0.6, label: '0.6', desc: 'Moderate' },
  { value: 0.9, label: '0.9', desc: 'High' },
  { value: 1.0, label: '1.0', desc: 'Full commit' },
];

export const DrillReveal = ({ card, citedDecision, onSetDial }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const narrative = card.narrative ?? {};
  const evidence = card.evidence ?? {};
  const quality = card.quality ?? {};
  const dial = card.operator?.currentDial ?? 0.6;

  const isLoading = !citedDecision || citedDecision.loading === true;
  const errorReason = citedDecision?.error;

  // Action labels + dividend — sourced from citedDecision when available;
  // fall back to "—" so the UI never blanks out mid-load.
  const baselineActionLabel = formatActionLabel(citedDecision?.baselineAction);
  const recommendedActionLabel = formatActionLabel(citedDecision?.recommendedAction);
  const dividend = Number.isFinite(citedDecision?.dividend) ? citedDecision.dividend : null;

  // Synthesis disclosure
  const isSynthesized = citedDecision?.source === 'synthesized';
  const display = citedDecision?.node?.display;

  return (
    <div className="p-6 rounded-lg bg-gray-800 border border-amber-500/30" data-testid="drill-reveal">
      {/* Synthesis disclosure */}
      {isSynthesized && display && (
        <div
          className="mb-3 inline-flex items-center gap-2 px-2 py-1 rounded text-xs bg-gray-900 border border-gray-700 text-gray-400"
          data-testid="drill-reveal-synthesis-badge"
        >
          <span aria-hidden>ⓘ</span>
          <span>
            Representative spot · {display.street} · {display.texture} · {display.position}
          </span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          className="grid grid-cols-2 gap-6 mb-4"
          data-testid="drill-reveal-loading"
        >
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Normally</div>
            <div className="text-gray-400 italic">Computing tonight's spot…</div>
          </div>
          <div>
            <div className="text-xs text-amber-400 uppercase tracking-wider mb-1">Here</div>
            <div className="text-gray-400 italic">…</div>
          </div>
        </div>
      )}

      {/* Error state — surface spec line 338 */}
      {!isLoading && errorReason && (
        <div
          className="p-4 rounded bg-amber-900/30 border border-amber-500/40 text-amber-200 text-sm mb-4"
          data-testid="drill-reveal-error"
        >
          <div className="font-semibold mb-1">Tonight's prep is having trouble computing this recommendation.</div>
          <div className="text-xs text-amber-300">
            {explainErrorReason(errorReason)} You can try again or skip this card.
          </div>
        </div>
      )}

      {/* Ready state — real labels + real dividend */}
      {!isLoading && !errorReason && citedDecision && (
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Normally</div>
            <div className="text-white font-semibold" data-testid="drill-reveal-baseline-action">
              {baselineActionLabel}
            </div>
          </div>
          <div>
            <div className="text-xs text-amber-400 uppercase tracking-wider mb-1">Here</div>
            <div className="text-amber-400 font-bold" data-testid="drill-reveal-recommended-action">
              {recommendedActionLabel}
            </div>
            {dividend !== null && (
              <div className="text-xs text-gray-400 mt-1" data-testid="drill-reveal-dividend">
                dividend {formatDividend(dividend)} bb
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact citation */}
      <div className="p-3 rounded bg-gray-900 border border-gray-700 flex items-center gap-2 text-sm" data-testid="drill-reveal-citation-compact">
        <span className="text-amber-400">●</span>
        <span className="text-white font-medium flex-1">
          {narrative.citationShort ?? narrative.humanStatement ?? 'Citation unavailable'}
        </span>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-amber-400 hover:text-amber-300 text-xs font-medium whitespace-nowrap"
          style={{ minHeight: 32 }}
          data-testid="drill-reveal-expand"
        >
          {isExpanded ? 'close ▲' : 'why →'}
        </button>
      </div>

      {/* Expanded form */}
      {isExpanded && (
        <div className="mt-4 p-4 rounded bg-gray-900 border border-gray-700" data-testid="drill-reveal-citation-expanded">
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Evidence</div>
              <div className="text-white">{narrative.humanStatement}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Reasoning</div>
              <div className="text-gray-300">{narrative.citationLong}</div>
            </div>
            {narrative.teachingPattern && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Recognition pattern</div>
                <div className="text-gray-300 italic">"{narrative.teachingPattern}"</div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-800">
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Confidence</div>
                <div className="text-white">{(evidence.posteriorConfidence * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Sample size</div>
                <div className="text-white">n={evidence.sampleSize}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Quality</div>
                <div className="text-white">{(quality.composite * 100).toFixed(0)}/100</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dial */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Confidence dial</span>
          <span className="text-xs text-gray-400">
            Current: <span className="text-amber-400 font-semibold">{dial.toFixed(2)}</span>
          </span>
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label="Confidence dial" data-testid="drill-reveal-dial">
          {DIAL_STEPS.map((step) => {
            const selected = Math.abs(dial - step.value) < 0.05;
            return (
              <button
                key={step.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSetDial(step.value)}
                className={`flex-1 px-2 py-2 rounded border text-sm transition-colors ${
                  selected
                    ? 'border-amber-500 bg-amber-900/30 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                }`}
                style={{ minHeight: 44 }}
                data-testid={`drill-reveal-dial-${step.value}`}
              >
                <div className="font-bold">{step.label}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{step.desc}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Dial to 0 returns the balanced play. Dial up to commit to the deviation.
        </p>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Formatting helpers — pure
// ───────────────────────────────────────────────────────────────────────────

const formatActionLabel = (action) => {
  if (!action || typeof action !== 'object') return '—';
  const name = ACTION_DISPLAY_NAMES[action.action] ?? action.action ?? '—';
  if (action.sizing && Number.isFinite(action.sizing) && action.action !== 'check' && action.action !== 'fold' && action.action !== 'call') {
    return `${name} ${(action.sizing * 100).toFixed(0)}%`;
  }
  return name;
};

const ACTION_DISPLAY_NAMES = Object.freeze({
  bet: 'Bet',
  check: 'Check',
  call: 'Call',
  fold: 'Fold',
  raise: 'Raise',
});

const formatDividend = (dividend) => {
  if (!Number.isFinite(dividend)) return '—';
  const sign = dividend >= 0 ? '+' : '';
  return `${sign}${dividend.toFixed(2)}`;
};

const explainErrorReason = (reason) => {
  switch (reason) {
    case 'gameTree-empty': return 'No actions evaluated.';
    case 'gameTree-error': return 'Compute error.';
    case 'gameTree-timeout': return 'Compute timed out.';
    case 'producer-returned-null': return 'No baseline available.';
    case 'producer-error': return 'Producer error.';
    case 'missing-assumption': return 'Missing assumption.';
    default: return 'Unknown error.';
  }
};
