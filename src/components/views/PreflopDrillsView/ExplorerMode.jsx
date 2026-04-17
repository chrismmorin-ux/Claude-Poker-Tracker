import React, { useEffect, useMemo, useState } from 'react';
import { HandPicker } from './HandPicker';
import { MatchupBreakdown } from './MatchupBreakdown';
import { computeHandVsHand, parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import { classifyMatchup } from '../../../utils/drillContent/frameworks';

/**
 * ExplorerMode — the reference/learning surface. User picks two hands;
 * exact equity + framework breakdown appear live. No correctness judgment,
 * no progress tracking.
 *
 * Computation is yielded via setTimeout(0) so the "computing…" state paints
 * before the main thread enters the ~1–3s enumeration for uncached matchups.
 * Cached matchups return in <1ms and feel instant.
 */
export const ExplorerMode = ({ initialHandA = 'AKs', initialHandB = 'JTs' }) => {
  const [handA, setHandA] = useState(initialHandA);
  const [handB, setHandB] = useState(initialHandB);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      try {
        const r = computeHandVsHand(handA, handB);
        setResult(r);
      } catch (e) {
        setError(e.message || String(e));
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [handA, handB]);

  const frameworkMatches = useMemo(() => {
    if (!result || error) return null;
    try {
      return classifyMatchup(parseHandClass(handA), parseHandClass(handB));
    } catch {
      return null;
    }
  }, [handA, handB, result, error]);

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      <div className="flex flex-col gap-4">
        <HandPicker label="Hand A" value={handA} onChange={setHandA} />
        <HandPicker label="Hand B" value={handB} onChange={setHandB} />
        <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-4 text-xs text-gray-400">
          <div className="font-semibold text-gray-300 mb-2">How to read this</div>
          <p className="mb-1">Equity is exact — every possible 5-card board enumerated, averaged across all valid suit combos for hand B.</p>
          <p>Use the framework chips on the right to decompose the result: domination / race structure + blockers + flush contention.</p>
        </div>
      </div>
      <div className="overflow-y-auto pr-2">
        {error ? (
          <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
            {error}
          </div>
        ) : (
          <MatchupBreakdown
            handALabel={handA}
            handBLabel={handB}
            result={result}
            frameworkMatches={frameworkMatches}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};
