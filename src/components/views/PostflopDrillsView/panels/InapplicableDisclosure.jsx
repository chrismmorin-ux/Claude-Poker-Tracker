/**
 * InapplicableDisclosure — collapsed list of bucket candidates that returned
 * zero live combos when a hero combo is pinned (LSW-H1).
 *
 * Keeps the main bucket table focused on buckets that actually carry an EV
 * for hero; still surfaces the inapplicable list on demand so the authored
 * candidate list remains auditable from the UI.
 *
 * Extracted from `BucketEVPanel.jsx` during LSW-G4-IMPL Commit 1
 * (primitive extraction, non-breaking). No behavior change from v1.
 */

import React, { useState } from 'react';

export const InapplicableDisclosure = ({ buckets, byBucket }) => {
  const [open, setOpen] = useState(false);
  const n = buckets.length;
  return (
    <div className="border border-gray-800 rounded bg-gray-900/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-gray-200"
      >
        <span>
          {n} bucket{n === 1 ? '' : 's'} not applicable to your hand
        </span>
        <span className="text-gray-600">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="px-3 py-1.5 text-[11px] text-gray-500 space-y-0.5">
          {buckets.map((bucketId) => {
            const entry = byBucket[bucketId];
            const reason = entry?.error
              ? entry.error
              : (entry?.result?.caveats?.includes('empty-bucket') ? 'no combos in range' : 'no combos');
            return (
              <li key={bucketId} className="font-mono">
                {bucketId} <span className="text-gray-600 italic not-italic font-normal">— {reason}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
