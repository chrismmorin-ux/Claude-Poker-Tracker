/**
 * DrillReveal.jsx — Reveal surface with citation + dial + expand control
 *
 * Per surface spec §Anatomy Mode 2 (reveal sub-state) and Mode 2-continued (expanded).
 *
 * v1 ships:
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

export const DrillReveal = ({ card, onSetDial }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const narrative = card.narrative ?? {};
  const evidence = card.evidence ?? {};
  const consequence = card.consequence ?? {};
  const quality = card.quality ?? {};
  const dial = card.operator?.currentDial ?? 0.6;

  const dividend = consequence.expectedDividend?.mean ?? 0;
  const baselineActionLabel = inferBaselineActionLabel(card);
  const recommendedActionLabel = inferRecommendedActionLabel(card);

  return (
    <div className="p-6 rounded-lg bg-gray-800 border border-amber-500/30" data-testid="drill-reveal">
      <div className="grid grid-cols-2 gap-6 mb-4">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Normally</div>
          <div className="text-white font-semibold">{baselineActionLabel}</div>
        </div>
        <div>
          <div className="text-xs text-amber-400 uppercase tracking-wider mb-1">Here</div>
          <div className="text-amber-400 font-bold">{recommendedActionLabel}</div>
          <div className="text-xs text-gray-400 mt-1">
            dividend +{dividend.toFixed(2)} bb / 100 firings
          </div>
        </div>
      </div>

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
// v1 heuristic labels — Commit 8.2+ will pull real labels from citedDecisionProducer
// ───────────────────────────────────────────────────────────────────────────

const inferBaselineActionLabel = (card) => {
  const dev = card.consequence?.deviationType;
  // For v1, derive a rough "normally" action inverse to the deviation:
  if (dev === 'bluff-prune') return 'bet (balanced)';
  if (dev === 'value-expand') return 'check (balanced)';
  if (dev === 'range-bet') return 'check (balanced)';
  if (dev === 'sizing-shift') return 'bet standard size';
  if (dev === 'spot-skip') return 'play the spot';
  return 'balanced play';
};

const inferRecommendedActionLabel = (card) => {
  const dev = card.consequence?.deviationType;
  if (dev === 'bluff-prune') return 'check (prune bluffs)';
  if (dev === 'value-expand') return 'bet (thin value)';
  if (dev === 'range-bet') return 'range-bet small';
  if (dev === 'sizing-shift') return 'shift sizing';
  if (dev === 'spot-skip') return 'skip the spot';
  return 'deviation line';
};
