/**
 * BucketEVTable — per-bucket EV rows grouped into applicable / inapplicable
 * partitions when a hero combo is pinned.
 *
 * When `demoted = true` (pinned-combo-row above), reframes as "other combos
 * in your range that fall in these buckets" with softened typography.
 *
 * Extracted from `BucketEVPanel.jsx` during LSW-G4-IMPL Commit 1
 * (primitive extraction, non-breaking). No behavior change from v1.
 */

import React from 'react';
import { BucketRow } from './BucketRow';
import { InapplicableDisclosure } from './InapplicableDisclosure';
import { CAVEAT_LABELS, isRowApplicable } from './panelHelpers';

export const BucketEVTable = ({ data, candidates, pinnedCombos, demoted = false }) => {
  if (data.rangeError) {
    return (
      <div className="bg-rose-900/30 border border-rose-800 text-rose-200 rounded px-3 py-2 text-xs">
        Range unavailable — {data.rangeError}
      </div>
    );
  }

  // Collect global caveats across all successful bucket results (dedup).
  const globalCaveats = new Set();
  for (const entry of Object.values(data.byBucket)) {
    if (entry?.result?.caveats) {
      for (const c of entry.result.caveats) globalCaveats.add(c);
    }
  }

  const hasPinnedCombo = Array.isArray(pinnedCombos) && pinnedCombos.length >= 1;
  const applicable = hasPinnedCombo
    ? candidates.filter((b) => isRowApplicable(data.byBucket[b]))
    : candidates;
  const inapplicable = hasPinnedCombo
    ? candidates.filter((b) => !isRowApplicable(data.byBucket[b]))
    : [];

  // When a pinned-combo row renders above, the bucket table is subsidiary.
  // Demote visually (divider + label) and relabel the header from "Your hand
  // class" to something that makes explicit this is NOT per-combo data.
  const headerLabel = demoted
    ? 'Bucket (other combos in your range)'
    : 'Your hand class';

  return (
    <div className="space-y-2">
      {demoted && applicable.length > 0 && (
        <div className="pt-1 text-[10px] uppercase tracking-wide text-gray-500">
          Range-level view · other combos in your range that fall in these buckets
        </div>
      )}
      {applicable.length > 0 ? (
        <div className={`overflow-hidden rounded border ${demoted ? 'border-gray-800' : 'border-gray-700'}`}>
          <table className={`w-full text-xs ${demoted ? 'opacity-80' : ''}`}>
            <thead>
              <tr className="bg-gray-900/60 text-gray-400">
                <th className="text-left px-2.5 py-1.5 font-medium">{headerLabel}</th>
                <th className="text-left px-2.5 py-1.5 font-medium">Best action</th>
                <th className="text-right px-2.5 py-1.5 font-medium">EV</th>
                <th className="text-right px-2.5 py-1.5 font-medium">Runner-up</th>
                <th className="text-center px-2.5 py-1.5 font-medium w-16">Sample</th>
              </tr>
            </thead>
            <tbody>
              {applicable.map((bucketId) => (
                <BucketRow key={bucketId} bucketId={bucketId} entry={data.byBucket[bucketId]} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        hasPinnedCombo && !demoted && (
          <div className="bg-gray-900/40 border border-gray-800 rounded px-3 py-2 text-xs text-gray-400 italic">
            No bucket with live combos for this authored candidate list.
          </div>
        )
      )}

      {hasPinnedCombo && inapplicable.length > 0 && (
        <InapplicableDisclosure buckets={inapplicable} byBucket={data.byBucket} />
      )}

      {globalCaveats.size > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center text-[10px] text-gray-500">
          <span className="uppercase tracking-wide">Caveats:</span>
          {[...globalCaveats].map((c) => (
            <span
              key={c}
              className="px-1.5 py-0.5 rounded bg-gray-800/70 border border-gray-700 text-gray-300"
            >
              {CAVEAT_LABELS[c] || c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
