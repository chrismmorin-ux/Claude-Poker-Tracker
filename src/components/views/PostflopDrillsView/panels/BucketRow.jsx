/**
 * BucketRow — single-bucket table row in `BucketEVTable`.
 *
 * Renders one of three shapes depending on entry state:
 *  - No data → dimmed placeholder row
 *  - `error === 'unknown-bucket'` → taxonomy-level diagnostic
 *  - any other error → error row with message
 *  - success → bucket label / best action / EV / runner-up / sample columns
 *
 * Empty-bucket state collapses the middle columns into a single italic
 * "No combos in range" span.
 *
 * Extracted from `BucketEVPanel.jsx` during LSW-G4-IMPL Commit 1
 * (primitive extraction, non-breaking). No behavior change from v1.
 */

import React from 'react';
import { formatEV, actionLabel } from './panelHelpers';

export const BucketRow = ({ bucketId, entry }) => {
  if (!entry) {
    return (
      <tr className="border-t border-gray-800">
        <td colSpan={5} className="px-2.5 py-1.5 text-gray-500 italic">No data for {bucketId}</td>
      </tr>
    );
  }
  if (entry.error === 'unknown-bucket') {
    return (
      <tr className="border-t border-gray-800">
        <td className="px-2.5 py-1.5 font-mono text-gray-400">{bucketId}</td>
        <td colSpan={4} className="px-2.5 py-1.5 text-gray-500 italic">
          Unknown bucket — authored content references a label not in the v1 taxonomy.
        </td>
      </tr>
    );
  }
  if (entry.error) {
    return (
      <tr className="border-t border-gray-800">
        <td className="px-2.5 py-1.5 font-mono text-gray-400">{bucketId}</td>
        <td colSpan={4} className="px-2.5 py-1.5 text-rose-300 italic">Error: {entry.error}</td>
      </tr>
    );
  }

  const result = entry.result;
  const bestId = result.ranking[0];
  const secondId = result.ranking[1];
  const best = result.evs[bestId];
  const second = secondId ? result.evs[secondId] : null;
  const sampleLow = result.caveats.includes('low-sample-bucket') || result.caveats.includes('empty-bucket');
  const emptyBucket = result.caveats.includes('empty-bucket');

  return (
    <tr className="border-t border-gray-800 hover:bg-gray-900/40">
      <td className="px-2.5 py-1.5 font-mono text-gray-200">{bucketId}</td>
      {emptyBucket ? (
        <td colSpan={3} className="px-2.5 py-1.5 text-gray-500 italic">
          No combos in range
        </td>
      ) : (
        <>
          <td className="px-2.5 py-1.5 text-teal-300 font-medium">{actionLabel(bestId, best)}</td>
          <td className="px-2.5 py-1.5 text-right font-mono text-teal-200">{formatEV(best.ev)}</td>
          <td className="px-2.5 py-1.5 text-right text-gray-400">
            {second ? (
              <span>
                <span className="text-[10px] mr-1">{actionLabel(secondId, second)}</span>
                <span className="font-mono">{formatEV(second.ev)}</span>
              </span>
            ) : (
              '—'
            )}
          </td>
        </>
      )}
      <td className="px-2.5 py-1.5 text-center">
        <span className={sampleLow ? 'text-amber-300' : 'text-gray-500'} title={`${result.sampleSize} combo${result.sampleSize === 1 ? '' : 's'}`}>
          {result.sampleSize}
        </span>
      </td>
    </tr>
  );
};
