/**
 * DominationMapDisclosure — collapsible row-list of villain hand-type
 * groups vs hero (LSW-G5, post-G5.1 precision-split + G5.2 pair+draw
 * composites).
 *
 * Each row: relation badge (crushed / dominated / neutral / favored /
 * dominating), group label, weight% of villain range, hero equity vs group.
 * Sorted heaviest-first by weightPct.
 *
 * Extracted from `BucketEVPanel.jsx` during LSW-G4-IMPL Commit 1
 * (primitive extraction, non-breaking). No behavior change from v1.
 */

import React, { useState } from 'react';
import { RELATION_STYLE } from './panelHelpers';

export const DominationMapDisclosure = ({ dominationMap }) => {
  const [open, setOpen] = useState(false);
  const n = dominationMap.length;
  return (
    <div className="border border-gray-800 rounded bg-gray-900/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-400 hover:text-gray-200"
      >
        <span>Domination vs villain's range · {n} hand-type group{n === 1 ? '' : 's'}</span>
        <span className="text-gray-600">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 pt-1 space-y-1">
          {dominationMap.map((row) => {
            const style = RELATION_STYLE[row.relation] || RELATION_STYLE.neutral;
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 text-[11px] py-1 border-b border-gray-800/50 last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-[150px]">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide font-semibold border ${style.color} ${style.bg} ${style.border}`}
                    title={`Hero equity ${(row.equity * 100).toFixed(0)}% → ${row.relation}`}
                  >
                    {style.label}
                  </span>
                  <span className="text-gray-200">{row.label}</span>
                </div>
                <div className="flex items-center gap-4 text-gray-500 font-mono flex-1 justify-end">
                  <span title={`${row.sampleSize} combos`}>{row.weightPct.toFixed(1)}% of range</span>
                  <span className={style.color}>{(row.equity * 100).toFixed(0)}% eq</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
