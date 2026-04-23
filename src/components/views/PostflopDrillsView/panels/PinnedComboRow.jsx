/**
 * PinnedComboRow — primary EV row for the pinned hero combo (LSW-H2).
 *
 * Distinct typography from the bucket-table rows so students read "here is
 * MY hand's EV" as different from "here is the average EV for combos in
 * this bucket class."
 *
 * Extracted from `BucketEVPanel.jsx` during LSW-G4-IMPL Commit 1
 * (primitive extraction, non-breaking). No behavior change from v1.
 */

import React from 'react';
import { formatEV, actionLabel } from './panelHelpers';

export const PinnedComboRow = ({ pinnedCombo, archetype }) => {
  if (!pinnedCombo) return null;
  if (pinnedCombo.error) {
    return (
      <div className="rounded border border-rose-800 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
        Per-combo EV error{pinnedCombo.comboString ? ` for ${pinnedCombo.comboString}` : ''}: {pinnedCombo.error}
      </div>
    );
  }
  const bestId = pinnedCombo.ranking?.[0];
  const secondId = pinnedCombo.ranking?.[1];
  const best = bestId ? pinnedCombo.evs[bestId] : null;
  const second = secondId ? pinnedCombo.evs[secondId] : null;
  const comboLabel = pinnedCombo.comboString || `${pinnedCombo.card1},${pinnedCombo.card2}`;
  return (
    <div className="rounded-md border border-amber-700/70 bg-amber-900/20 p-3 space-y-1.5">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wide text-amber-300/90">
          Your hand · per-combo EV
        </div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          vs {archetype}
        </div>
      </div>
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="font-mono text-lg text-amber-100">{comboLabel}</span>
        <span className="text-[11px] text-gray-400">
          equity <span className="font-mono text-gray-200">{(pinnedCombo.equity * 100).toFixed(1)}%</span>
        </span>
        {best && (
          <span className="text-[11px] text-gray-400">
            best <span className="text-teal-300 font-medium">{actionLabel(bestId, best)}</span>
            <span className="ml-1.5 font-mono text-teal-200">{formatEV(best.ev)}</span>
          </span>
        )}
        {second && (
          <span className="text-[11px] text-gray-500">
            runner-up <span className="mr-1">{actionLabel(secondId, second)}</span>
            <span className="font-mono">{formatEV(second.ev)}</span>
          </span>
        )}
      </div>
    </div>
  );
};
