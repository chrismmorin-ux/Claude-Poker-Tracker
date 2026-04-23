/**
 * ConfidenceDisclosure (P6) — bottom-of-panel strip listing confidence-
 * affecting facts for the current render.
 *
 * MC trial count + population-prior source + archetype applied + caveat
 * chips. Addresses H-N01 (system status visibility) + the Gate-4 F-E2
 * simplified-EV honesty concern by surfacing the `v1-simplified-ev`
 * caveat visibly rather than burying it.
 */

import React, { useState } from 'react';

const CAVEAT_LABELS = {
  'synthetic-range':    'synthetic range',
  'v1-simplified-ev':   'simplified EV',
  'time-budget-soft':   'over time budget',
  'empty-bucket':       'no combos',
  'low-sample-bucket':  'low sample',
  'time-budget-bailout': 'partial result',
};

/**
 * Props:
 *   confidence: { mcTrials, populationPriorSource, archetype, caveats: string[] }
 */
export const ConfidenceDisclosure = ({ confidence }) => {
  const [open, setOpen] = useState(false);
  if (!confidence) return null;
  const { mcTrials, populationPriorSource, archetype, caveats = [] } = confidence;

  return (
    <div className="rounded border border-gray-800 bg-gray-900/20 text-[10px]">
      <div className="flex items-center justify-between gap-2 px-3 py-1 min-h-[32px]">
        <div className="flex items-center gap-2 text-gray-500">
          <span>MC trials: {mcTrials}</span>
          <span>·</span>
          <span>archetype: {archetype}</span>
          {caveats.length > 0 && (
            <>
              <span>·</span>
              <div className="flex flex-wrap gap-1">
                {caveats.map((c) => (
                  <span
                    key={c}
                    className="px-1 py-0 rounded bg-gray-800/70 border border-gray-700 text-gray-300 text-[9px]"
                  >
                    {CAVEAT_LABELS[c] || c}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-[32px] text-gray-500 hover:text-gray-300 whitespace-nowrap"
        >
          {open ? 'hide methodology' : 'methodology ▸'}
        </button>
      </div>
      {open && (
        <div className="px-3 py-2 border-t border-gray-800/60 text-[10px] text-gray-400 space-y-1">
          <div>
            <span className="text-gray-500">MC trials: </span>
            <span className="text-gray-200">{mcTrials}</span>
            <span className="text-gray-500 ml-2">(± rough CI = 1/√trials)</span>
          </div>
          <div>
            <span className="text-gray-500">Population priors: </span>
            <span className="text-gray-200">{populationPriorSource}</span>
          </div>
          <div>
            <span className="text-gray-500">Archetype: </span>
            <span className="text-gray-200">{archetype}</span>
          </div>
          {caveats.length > 0 && (
            <div className="pt-1">
              <div className="text-gray-500 mb-0.5">Caveats:</div>
              <ul className="pl-4 space-y-0.5 list-disc marker:text-gray-600">
                {caveats.map((c) => (
                  <li key={c}>
                    <span className="text-gray-200">{CAVEAT_LABELS[c] || c}</span>
                    {c === 'v1-simplified-ev' && (
                      <span className="text-gray-500 ml-1">
                        — bucket-EV uses coarse priors; LSW-D1 depth-2 will refine.
                      </span>
                    )}
                    {c === 'synthetic-range' && (
                      <span className="text-gray-500 ml-1">
                        — villain range is an archetype stub, not observed data.
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
