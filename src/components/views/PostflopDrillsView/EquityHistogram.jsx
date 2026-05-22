/**
 * EquityHistogram — Range Lab Phase 2 (WS-057) equity-vs-random distribution.
 *
 * Renders a manual Compute affordance (mirrors Archetype mode's MC checkbox —
 * the per-combo equity pass is too heavy to run on every paint stroke) and,
 * once computed, a horizontal bar per equity bin plus the range's mean equity
 * vs a random hand.
 *
 * The result is invalidated whenever the input combo set or board changes
 * (parent passes a fresh `inputKey`), prompting a fresh Compute — we never
 * show an equity distribution that no longer matches the painted range.
 *
 * Equity is a Monte-Carlo estimate (handVsRange) — surfaced with a one-line
 * caveat. No grading, no progress tracking beyond the in-flight bar.
 */

import React, { useEffect, useRef, useState } from 'react';
import { computeEquityHistogram, DEFAULT_HISTOGRAM_TRIALS } from '../../../utils/postflopDrillContent/rangeEquityHistogram';

const pct = (p) => `${Math.round(p * 100)}%`;
const binLabel = (bin) => `${Math.round(bin.lo * 100)}–${Math.round(bin.hi * 100)}%`;

/**
 * @param {object} props
 * @param {Array<{card1,card2,weight}>} props.combos  combos to evaluate (already subrange-filtered)
 * @param {number[]} props.board  3–5 encoded board cards
 * @param {string} props.inputKey  changes when combos/board change → clears stale result
 * @param {(combos, board, opts) => Promise} [props.computeFn]  injectable for tests
 */
export const EquityHistogram = ({ combos, board, inputKey, computeFn = computeEquityHistogram }) => {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const runToken = useRef(0);

  // Invalidate any prior result when the painted range / board / filter changes.
  useEffect(() => {
    setResult(null);
    setRunning(false);
    setProgress({ done: 0, total: 0 });
    runToken.current += 1; // abandon any in-flight pass
  }, [inputKey]);

  const comboCount = Array.isArray(combos) ? combos.length : 0;

  const run = async () => {
    const token = ++runToken.current;
    setRunning(true);
    setProgress({ done: 0, total: comboCount });
    const res = await computeFn(combos, board, {
      onProgress: (done, total) => {
        if (runToken.current === token) setProgress({ done, total });
      },
    });
    if (runToken.current !== token) return; // superseded by a newer run / invalidation
    setResult(res);
    setRunning(false);
  };

  const maxPct = result ? Math.max(0.0001, ...result.bins.map((b) => b.pct)) : 1;

  return (
    <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-400">Equity vs random hand</span>
        <button
          type="button"
          onClick={run}
          disabled={running || comboCount === 0}
          className="text-xs font-semibold rounded px-3 py-1.5 border bg-teal-600 border-teal-500 text-white hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? `Computing… ${progress.done}/${progress.total}` : result ? 'Recompute' : 'Compute'}
        </button>
      </div>

      {comboCount === 0 ? (
        <div className="text-xs text-gray-500">No combos in the current selection.</div>
      ) : !result && !running ? (
        <div className="text-xs text-gray-500">
          Press Compute to estimate the equity distribution of {comboCount} combo{comboCount === 1 ? '' : 's'} vs a random hand.
        </div>
      ) : running ? (
        <div className="text-xs text-gray-400">Running Monte-Carlo equity…</div>
      ) : (
        <>
          <div className="text-[11px] text-gray-400 mb-2">
            Mean equity <span className="font-mono font-semibold text-teal-300">{pct(result.meanEquity)}</span>
            {' · '}{result.combosEvaluated} combo{result.combosEvaluated === 1 ? '' : 's'}
          </div>
          <div className="space-y-1">
            {result.bins.map((bin) => (
              <div key={bin.lo} className="flex items-center gap-2 text-xs">
                <div className="w-16 text-right font-mono text-gray-400">{binLabel(bin)}</div>
                <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-teal-500 transition-all"
                    style={{ width: `${(bin.pct / maxPct) * 100}%` }}
                    title={pct(bin.pct)}
                  />
                </div>
                <div className="w-10 text-right font-mono text-gray-200">{pct(bin.pct)}</div>
                <div className="w-9 text-right text-gray-500">{bin.count}×</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-gray-500">
            Monte-Carlo estimate (~{result.trials ?? DEFAULT_HISTOGRAM_TRIALS} trials/combo) — small run-to-run variation is expected.
          </div>
        </>
      )}
    </div>
  );
};
