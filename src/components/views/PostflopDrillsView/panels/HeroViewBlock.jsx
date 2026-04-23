/**
 * HeroViewBlock (P3) — hero's view as context, not answer.
 *
 * I-DM-3: the hero's specific holding is shown as a context header, NOT
 * as the decision answer. The EV answer lives in P2 (WeightedTotalTable).
 * This primitive's interface deliberately excludes `bestActionLabel`,
 * `totalEV`, `recommendedAction` — trying to render the answer from P3
 * requires changing its interface (grep-visible).
 *
 * v1 ship mode: `single-combo`. `combo-set` and `range-level` stubs exist
 * so the composition root can route — their render bodies throw a
 * structured notice when invoked.
 */

import React from 'react';

/**
 * Props:
 *   mode: 'single-combo' | 'combo-set' | 'range-level'
 *   combo?: { card1, card2, comboString }
 *   combos?: Array<string>
 *   classLabel?: string
 */
export const HeroViewBlock = ({ mode, combo, combos, classLabel }) => {
  if (mode === 'single-combo') {
    const label = combo?.comboString
      || (combos && combos[0])
      || '—';
    return (
      <div className="rounded-md border border-amber-700/70 bg-amber-900/20 p-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] uppercase tracking-wide text-amber-300/90">
              Your hand
            </span>
            <span className="font-mono text-lg text-amber-100">{label}</span>
          </div>
          {classLabel && (
            <span className="text-[11px] text-gray-400 italic">({classLabel})</span>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'combo-set') {
    return (
      <div className="rounded-md border border-amber-700/70 bg-amber-900/20 p-2.5 text-[11px] text-amber-100">
        <span className="uppercase tracking-wide text-[10px] text-amber-300/90 mr-2">Your hand class</span>
        {classLabel || 'combo set'}
        {combos && combos.length > 0 && (
          <span className="ml-2 text-gray-400 font-mono text-[10px]">
            ({combos.length} combo{combos.length === 1 ? '' : 's'})
          </span>
        )}
      </div>
    );
  }

  if (mode === 'range-level') {
    return (
      <div className="rounded border border-gray-800 bg-gray-900/30 px-3 py-2 text-[11px] text-gray-400 italic">
        Range-level hero view — v1.1 scope (bar chart rendering deferred; see
        bucket-ev-panel-v2 spec V10).
      </div>
    );
  }

  // Unknown mode — degrade to a visible placeholder rather than silently
  // skipping the block.
  return (
    <div className="rounded border border-gray-800 bg-gray-900/30 px-3 py-2 text-[11px] text-gray-500 italic">
      Unknown hero-view mode '{mode}'.
    </div>
  );
};
