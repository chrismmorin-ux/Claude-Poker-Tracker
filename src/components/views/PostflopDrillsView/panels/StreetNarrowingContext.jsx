/**
 * StreetNarrowingContext (P5) — docked above P1 on non-root nodes.
 *
 * Axis-5 support: shows how villain's range narrowed from the prior node.
 * Renders a 2-line summary by default; full narrowing history expands via
 * "show full history" tap. On flop_root / pre_root (no prior narrowing),
 * the primitive renders nothing — P5 is absent in the composition.
 *
 * Ordered `streetNarrowing` array from `computeBucketEVsV2`. Each entry:
 *   { street, actor, action, sizing?, narrowingSpec, priorWeight, narrowedWeight }
 */

import React, { useState } from 'react';

const ACTOR_COLOR = {
  hero: 'text-amber-300',
  villain: 'text-rose-300',
  villain1: 'text-rose-300',
  villain2: 'text-orange-300',
};

const formatStep = (step) => {
  const colorClass = ACTOR_COLOR[step.actor] || 'text-gray-300';
  const sizingStr = typeof step.sizing === 'number'
    ? ` ${Math.round(step.sizing * 100)}%`
    : '';
  return (
    <span key={`${step.street}-${step.actor}-${step.action}`} className="whitespace-nowrap">
      <span className="text-[9px] uppercase text-gray-500">{step.street}</span>{' '}
      <span className={`${colorClass} font-medium`}>{step.actor}</span>{' '}
      <span className="text-gray-200">{step.action}{sizingStr}</span>
    </span>
  );
};

/**
 * Props:
 *   streetNarrowing: Array | null
 */
export const StreetNarrowingContext = ({ streetNarrowing }) => {
  const [expanded, setExpanded] = useState(false);

  if (!Array.isArray(streetNarrowing) || streetNarrowing.length === 0) {
    return null;
  }

  // 2-line summary shows the most recent step (the one that produced this
  // node's villain range). Expanded view shows the full ordered trace.
  const lastStep = streetNarrowing[streetNarrowing.length - 1];

  return (
    <div className="rounded border border-gray-800 bg-gray-900/30 text-[11px]">
      <div className="px-3 py-1.5 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-wide text-gray-500">Narrowed by</span>
          {formatStep(lastStep)}
          {lastStep.priorWeight !== lastStep.narrowedWeight && (
            <span className="text-gray-500 font-mono text-[10px]">
              {lastStep.priorWeight.toFixed(0)}% → {lastStep.narrowedWeight.toFixed(0)}%
            </span>
          )}
        </div>
        {streetNarrowing.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="min-h-[32px] text-[10px] text-teal-300 hover:text-teal-200 underline whitespace-nowrap"
          >
            {expanded ? 'hide history' : `show full history (${streetNarrowing.length})`}
          </button>
        )}
      </div>
      {expanded && streetNarrowing.length > 1 && (
        <div className="px-3 pb-2 pt-0.5 border-t border-gray-800/60 space-y-0.5">
          {streetNarrowing.map((step, i) => (
            <div key={`${step.street}-${step.actor}-${i}`} className="flex items-baseline gap-2">
              <span className="text-gray-600 text-[9px] font-mono">#{i + 1}</span>
              {formatStep(step)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
